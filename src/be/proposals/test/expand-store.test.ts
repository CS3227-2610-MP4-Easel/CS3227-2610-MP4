import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { createDbClient } from "@agile/db";
import { ProposalError, claimEpic, createProposal, failEpic, storeEpic, EXPAND_LEASE_MS, type EpicTask } from "../src/index.js";
import { integrationUrl, withIntegrationDb, type Fixtures } from "./fakes.js";

const tasks: EpicTask[] = [{ title: "T1", description: "d", acceptanceCriteria: ["a"], storyPoints: 3 }];
const opts = { skip: !integrationUrl };

async function seed(base: PrismaClient, f: Fixtures, epicCount = 2) {
  const pm = await f.user();
  const project = await f.project(pm);
  await f.member(project, pm);
  const sessionId = await f.aiSession(pm, project);
  const db = createDbClient(base);
  const proposalId = await createProposal(db, {
    projectId: project, creatorId: pm, sessionId, flagged: false, approach: "the approach", checkpoints: [], retrieved: [],
    epics: Array.from({ length: epicCount }, (_, i) => ({ title: `Epic ${i}`, description: `d${i}`, checkpointName: null })),
  });
  return { pm, project, sessionId, db, proposalId };
}

const epicRow = (base: PrismaClient, proposalId: string, index = 0) => base.proposalEpic.findUniqueOrThrow({ where: { proposalId_index: { proposalId, index } } });
const proposalRow = (base: PrismaClient, id: string) => base.aiProposal.findUniqueOrThrow({ where: { id } });
const code = (promise: Promise<unknown>) => promise.then(() => "OK", (e: unknown) => (e instanceof ProposalError ? e.code : `OTHER:${String(e)}`));

/** Holds a row lock on the proposal until `release` is called; resolves `locked` once the lock is taken. */
function holdProposalLock(base: PrismaClient, proposalId: string, inside?: (tx: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]) => Promise<void>) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let locked!: () => void;
  const lockedPromise = new Promise<void>((resolve) => { locked = resolve; });
  const holder = { pid: 0 };
  const done = base.$transaction(async (tx) => {
    await tx.aiProposal.update({ where: { id: proposalId }, data: { updatedAt: new Date() } });
    if (inside) await inside(tx);
    const rows = await tx.$queryRaw<{ pid: number }[]>`select pg_backend_pid() as pid`;
    holder.pid = Number(rows[0].pid);
    locked();
    await gate;
  }, { timeout: 30_000 });
  // A failed hold must not leave the test waiting forever.
  done.catch(() => locked());
  return { release, locked: lockedPromise, done, holder };
}

/** Waits until a backend is blocked by the holder's backend (the second transaction is waiting). */
async function waitForBlocked(base: PrismaClient, holderPid: number): Promise<void> {
  for (let i = 0; i < 100; i += 1) {
    const rows = await base.$queryRaw<{ n: bigint }[]>`select count(*)::bigint as n from pg_stat_activity a where ${holderPid}::int = any(pg_blocking_pids(a.pid))`;
    if (Number(rows[0].n) > 0) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error("second transaction never blocked");
}

test("E22 an epic that is already DONE is returned with its stored tasks and nothing is written", opts, async () => {
  await withIntegrationDb(async (base, f) => {
    const { db, proposalId, pm } = await seed(base, f);
    const first = await claimEpic(db, { proposalId, index: 0, actorId: pm });
    assert.equal(first.kind, "CLAIMED");
    if (first.kind !== "CLAIMED") return;
    await storeEpic(db, { proposalId, index: 0, claimedVersion: first.claimedVersion, tasks, flagged: false });
    const before = await epicRow(base, proposalId);
    const again = await claimEpic(db, { proposalId, index: 0, actorId: pm });
    assert.equal(again.kind, "DONE");
    if (again.kind !== "DONE") return;
    assert.deepEqual(again.epic.expansion.tasks, tasks);
    assert.equal(again.epic.expansion.status, "DONE");
    const after = await epicRow(base, proposalId);
    assert.equal(after.version, before.version);
    assert.equal(after.version, 3);
  });
});

test("E23 an IN_PROGRESS epic with a live lease gives CONFLICT_STATE and is not changed (lease equal to now is live)", opts, async () => {
  await withIntegrationDb(async (base, f) => {
    const { db, proposalId, pm } = await seed(base, f);
    const now = new Date("2026-11-07T10:00:00.000Z");
    const first = await claimEpic(db, { proposalId, index: 0, actorId: pm, now });
    assert.equal(first.kind, "CLAIMED");
    if (first.kind !== "CLAIMED") return;
    assert.equal(first.claimedVersion, 2);
    assert.equal(first.approach, "the approach");
    assert.equal((await epicRow(base, proposalId)).leaseExpiresAt?.getTime(), now.getTime() + EXPAND_LEASE_MS);
    const before = await epicRow(base, proposalId);
    assert.equal(await code(claimEpic(db, { proposalId, index: 0, actorId: pm, now: new Date(now.getTime() + 1000) })), "CONFLICT_STATE");
    assert.equal(await code(claimEpic(db, { proposalId, index: 0, actorId: pm, now: new Date(now.getTime() + EXPAND_LEASE_MS) })), "CONFLICT_STATE");
    const after = await epicRow(base, proposalId);
    assert.equal(after.version, before.version);
    assert.equal(after.leaseExpiresAt?.getTime(), before.leaseExpiresAt?.getTime());
    assert.equal(after.expansionStatus, "IN_PROGRESS");
  });
});

test("E24a the second expand arrives while the first holds the claim: one claim succeeds, the other CONFLICT_STATE", opts, async () => {
  await withIntegrationDb(async (base, f) => {
    const { db, proposalId, pm } = await seed(base, f);
    // Transaction A is the first expand in the middle of its claim: it holds the proposal lock and has marked the epic.
    const hold = holdProposalLock(base, proposalId, async (tx) => {
      await tx.proposalEpic.update({
        where: { proposalId_index: { proposalId, index: 0 } },
        data: { expansionStatus: "IN_PROGRESS", leaseExpiresAt: new Date(Date.now() + EXPAND_LEASE_MS), version: 2 },
      });
    });
    let second: Promise<string> | undefined;
    try {
      await hold.locked;
      second = code(claimEpic(db, { proposalId, index: 0, actorId: pm }));
      await waitForBlocked(base, hold.holder.pid);
    } finally {
      hold.release();
    }
    await hold.done;
    assert.equal(await second, "CONFLICT_STATE");
    const row = await epicRow(base, proposalId);
    assert.equal(row.version, 2);
    assert.equal(row.expansionStatus, "IN_PROGRESS");
  });
});

test("E24a two parallel expands of one PENDING epic: exactly one claims", opts, async () => {
  await withIntegrationDb(async (base, f) => {
    const { db, proposalId, pm } = await seed(base, f);
    const results = await Promise.all([
      claimEpic(db, { proposalId, index: 0, actorId: pm }).then((r) => r.kind, (e: unknown) => (e as ProposalError).code),
      claimEpic(db, { proposalId, index: 0, actorId: pm }).then((r) => r.kind, (e: unknown) => (e as ProposalError).code),
    ]);
    assert.deepEqual([...results].sort(), ["CLAIMED", "CONFLICT_STATE"]);
    assert.equal((await epicRow(base, proposalId)).version, 2);
  });
});

test("E24b the second expand arrives after the first stored its result: DONE with the stored tasks", opts, async () => {
  await withIntegrationDb(async (base, f) => {
    const { db, proposalId, pm } = await seed(base, f);
    const hold = holdProposalLock(base, proposalId);
    let first: Promise<unknown> | undefined;
    let second: ReturnType<typeof claimEpic> | undefined;
    try {
      await hold.locked;
      first = claimEpic(db, { proposalId, index: 0, actorId: pm });
      await waitForBlocked(base, hold.holder.pid);
    } finally {
      hold.release();
    }
    await hold.done;
    const claimed = (await first) as Awaited<ReturnType<typeof claimEpic>>;
    assert.equal(claimed.kind, "CLAIMED");
    if (claimed.kind !== "CLAIMED") return;
    await storeEpic(db, { proposalId, index: 0, claimedVersion: claimed.claimedVersion, tasks, flagged: false });
    second = claimEpic(db, { proposalId, index: 0, actorId: pm });
    const result = await second;
    assert.equal(result.kind, "DONE");
    if (result.kind === "DONE") assert.deepEqual(result.epic.expansion.tasks, tasks);
    assert.equal((await epicRow(base, proposalId)).version, 3);
  });
});

test("E25 the first function died: after the lease passes the epic is claimed again, stored, and versions increase across claims and stores", opts, async () => {
  await withIntegrationDb(async (base, f) => {
    const { db, proposalId, pm } = await seed(base, f);
    const t0 = new Date("2026-11-07T10:00:00.000Z");
    const dead = await claimEpic(db, { proposalId, index: 0, actorId: pm, now: t0 });
    assert.equal(dead.kind, "CLAIMED");
    if (dead.kind !== "CLAIMED") return;
    assert.equal(dead.claimedVersion, 2);
    const later = new Date(t0.getTime() + EXPAND_LEASE_MS + 1);
    const again = await claimEpic(db, { proposalId, index: 0, actorId: pm, now: later });
    assert.equal(again.kind, "CLAIMED");
    if (again.kind !== "CLAIMED") return;
    assert.equal(again.claimedVersion, 3);
    // the dead function's late result is discarded, never merged
    assert.equal(await code(storeEpic(db, { proposalId, index: 0, claimedVersion: dead.claimedVersion, tasks: [], flagged: true })), "CONFLICT_STATE");
    await failEpic(db, { proposalId, index: 0, claimedVersion: dead.claimedVersion, error: "LATE" });
    let row = await epicRow(base, proposalId);
    assert.equal(row.version, 3);
    assert.equal(row.expansionStatus, "IN_PROGRESS");
    assert.equal(row.tasks, null);
    assert.equal((await proposalRow(base, proposalId)).flagged, false);
    const stored = await storeEpic(db, { proposalId, index: 0, claimedVersion: again.claimedVersion, tasks, flagged: false });
    assert.equal(stored.expansion.status, "DONE");
    row = await epicRow(base, proposalId);
    assert.equal(row.version, 4);
    assert.equal(row.leaseExpiresAt, null);
    assert.equal(row.error, null);
    // a FAILED epic is claimable and keeps counting versions
    const second = await claimEpic(db, { proposalId, index: 1, actorId: pm });
    assert.equal(second.kind, "CLAIMED");
    if (second.kind !== "CLAIMED") return;
    await failEpic(db, { proposalId, index: 1, claimedVersion: second.claimedVersion, error: "GATEWAY_TIMEOUT" });
    const failed = await epicRow(base, proposalId, 1);
    assert.deepEqual([failed.expansionStatus, failed.error, failed.leaseExpiresAt, failed.version], ["FAILED", "GATEWAY_TIMEOUT", null, second.claimedVersion + 1]);
    const retry = await claimEpic(db, { proposalId, index: 1, actorId: pm });
    assert.equal(retry.kind, "CLAIMED");
    const retried = await epicRow(base, proposalId, 1);
    assert.equal(retried.error, null);
    assert.equal(retried.version, failed.version + 1);
  });
});

test("E27 a reject landing while the model runs: storeEpic throws CONFLICT_STATE and nothing else changes", opts, async () => {
  await withIntegrationDb(async (base, f) => {
    const { db, proposalId, pm } = await seed(base, f);
    const claimed = await claimEpic(db, { proposalId, index: 0, actorId: pm });
    assert.equal(claimed.kind, "CLAIMED");
    if (claimed.kind !== "CLAIMED") return;
    await base.aiProposal.update({ where: { id: proposalId }, data: { status: "REJECTED", version: { increment: 1 } } });
    const epicBefore = await epicRow(base, proposalId);
    const proposalBefore = await proposalRow(base, proposalId);
    assert.equal(await code(storeEpic(db, { proposalId, index: 0, claimedVersion: claimed.claimedVersion, tasks, flagged: true })), "CONFLICT_STATE");
    await failEpic(db, { proposalId, index: 0, claimedVersion: claimed.claimedVersion, error: "X" });
    const epicAfter = await epicRow(base, proposalId);
    const proposalAfter = await proposalRow(base, proposalId);
    assert.equal(epicAfter.expansionStatus, "IN_PROGRESS");
    assert.equal(epicAfter.tasks, null);
    assert.equal(epicAfter.error, null);
    assert.equal(epicAfter.version, epicBefore.version);
    assert.equal(epicAfter.leaseExpiresAt?.getTime(), epicBefore.leaseExpiresAt?.getTime());
    assert.equal(proposalAfter.status, "REJECTED");
    assert.equal(proposalAfter.flagged, false);
    assert.equal(proposalAfter.version, proposalBefore.version);
    // and a new claim on a non-PENDING proposal is also CONFLICT_STATE
    assert.equal(await code(claimEpic(db, { proposalId, index: 1, actorId: pm })), "CONFLICT_STATE");
  });
});

test("E27 an approve landing while the model runs: storeEpic throws CONFLICT_STATE", opts, async () => {
  await withIntegrationDb(async (base, f) => {
    const { db, proposalId, pm } = await seed(base, f);
    const claimed = await claimEpic(db, { proposalId, index: 0, actorId: pm });
    assert.equal(claimed.kind, "CLAIMED");
    if (claimed.kind !== "CLAIMED") return;
    await base.aiProposal.update({ where: { id: proposalId }, data: { status: "APPROVED", version: { increment: 1 } } });
    assert.equal(await code(storeEpic(db, { proposalId, index: 0, claimedVersion: claimed.claimedVersion, tasks, flagged: true })), "CONFLICT_STATE");
    const epic = await epicRow(base, proposalId);
    assert.deepEqual([epic.expansionStatus, epic.tasks, epic.version], ["IN_PROGRESS", null, 2]);
    assert.deepEqual([(await proposalRow(base, proposalId)).flagged, (await proposalRow(base, proposalId)).version], [false, 2]);
  });
});

test("a flagged store marks the proposal flagged without changing its version", opts, async () => {
  await withIntegrationDb(async (base, f) => {
    const { db, proposalId, pm } = await seed(base, f);
    const claimed = await claimEpic(db, { proposalId, index: 0, actorId: pm });
    if (claimed.kind !== "CLAIMED") throw new Error("expected claim");
    await storeEpic(db, { proposalId, index: 0, claimedVersion: claimed.claimedVersion, tasks, flagged: true });
    const proposal = await proposalRow(base, proposalId);
    assert.equal(proposal.flagged, true);
    assert.equal(proposal.version, 1);
  });
});

test("a non-creator and bad indexes get NOT_FOUND and leave the rows untouched", opts, async () => {
  await withIntegrationDb(async (base, f) => {
    const { db, proposalId, pm, project } = await seed(base, f);
    const other = await f.user();
    await f.member(project, other);
    const before = await epicRow(base, proposalId);
    assert.equal(await code(claimEpic(db, { proposalId, index: 0, actorId: other })), "NOT_FOUND");
    assert.equal(await code(claimEpic(db, { proposalId: randomUUID(), index: 0, actorId: pm })), "NOT_FOUND");
    for (const index of [-1, Number.NaN, 2, 1.5]) {
      assert.equal(await code(claimEpic(db, { proposalId, index, actorId: pm })), "NOT_FOUND", `index ${index}`);
    }
    const after = await epicRow(base, proposalId);
    assert.deepEqual([after.expansionStatus, after.version, after.leaseExpiresAt], [before.expansionStatus, before.version, before.leaseExpiresAt]);
    assert.equal((await epicRow(base, proposalId, 1)).version, 1);
    assert.equal((await proposalRow(base, proposalId)).version, 1);
  });
});
