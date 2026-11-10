import assert from "node:assert/strict";
import test from "node:test";
import { addEpic, claimEpic, claimPlanEpics, deleteEpic, editEpic, failPlanEpics, storePlanEpics, ProposalError, EXPAND_LEASE_MS } from "../src/index.js";
import { holdProposalLock, seed } from "./edit-helpers.js";
import { integrationUrl, withIntegrationDb } from "./fakes.js";
import type { FilteredDbClient, FilteredTransactionClient } from "@agile/db";

const opts = { skip: !integrationUrl };
const code = (promise: Promise<unknown>) => promise.then(() => "OK", (e: unknown) => e instanceof ProposalError ? e.code : `OTHER:${String(e)}`);
const tasks = [{ title: "Task", description: "d", acceptanceCriteria: ["a"], storyPoints: 3 }];
const row = (base: Parameters<Parameters<typeof withIntegrationDb>[0]>[0], proposalId: string, index: number) => base.proposalEpic.findUniqueOrThrow({ where: { proposalId_index: { proposalId, index } } });

function pauseAfterProposalLock(db: FilteredDbClient) {
  let release!: () => void, locked!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const acquired = new Promise<void>(resolve => { locked = resolve; });
  let paused = false;
  const wrapped = new Proxy(db, { get(target, key, receiver) {
    if (key !== "$transaction") return Reflect.get(target, key, receiver);
    return (fn: (tx: FilteredTransactionClient) => Promise<unknown>) => target.$transaction(async tx => {
      const proposal = new Proxy(tx.aiProposal, { get(delegate, method, delegateReceiver) {
        if (method !== "update") return Reflect.get(delegate, method, delegateReceiver);
        return async (...args: Parameters<typeof delegate.update>) => {
          const result = await delegate.update(...args);
          if (!paused) { paused = true; locked(); await gate; }
          return result;
        };
      } });
      return fn(new Proxy(tx, { get(client, method, clientReceiver) { return method === "aiProposal" ? proposal : Reflect.get(client, method, clientReceiver); } }));
    });
  } });
  return { db: wrapped, acquired, release };
}

async function waitForBlocked(base: Parameters<Parameters<typeof withIntegrationDb>[0]>[0], applicationName: string) {
  for (let i = 0; i < 100; i++) {
    const rows = await base.$queryRaw<{ n: bigint }[]>`select count(*)::bigint as n from pg_stat_activity where application_name = ${applicationName} and cardinality(pg_blocking_pids(pid)) > 0`;
    if (Number(rows[0].n)) return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error("transaction never blocked");
}

test("W7c E11 E14 claim pending and expired or failed epics beside done epics", opts, async () => {
  await withIntegrationDb(async (base, f) => {
    const { db, proposalId, pm } = await seed(base, f, 4);
    await base.proposalEpic.updateMany({ where: { proposalId, index: { in: [0, 1] } }, data: { expansionStatus: "DONE", tasks } });
    const result = await claimPlanEpics(db, { proposalId, actorId: pm, version: 1 });
    assert.equal(result.kind, "CLAIMED");
    if (result.kind === "CLAIMED") {
      assert.deepEqual(result.done, [
        { index: 0, title: "Epic 0", description: "d0", checkpointName: null, tasks },
        { index: 1, title: "Epic 1", description: "d1", checkpointName: null, tasks },
      ]);
      assert.deepEqual(result.targets.map(e => e.index), [2, 3]);
    }
    const other = await seed(base, f, 2);
    await base.proposalEpic.update({ where: { proposalId_index: { proposalId: other.proposalId, index: 0 } }, data: { expansionStatus: "FAILED" } });
    await base.proposalEpic.update({ where: { proposalId_index: { proposalId: other.proposalId, index: 1 } }, data: { expansionStatus: "IN_PROGRESS", leaseExpiresAt: new Date(0) } });
    const retry = await claimPlanEpics(other.db, { proposalId: other.proposalId, actorId: other.pm, version: 1 });
    assert.equal(retry.kind, "CLAIMED");
    if (retry.kind === "CLAIMED") { assert.deepEqual(retry.targets.map(e => e.index), [0, 1]); assert.equal(retry.targets[1].claimedVersion, retry.targets[0].claimedVersion + 1); }
  });
});

test("W7c E15 E30 stale and closed proposals or overflowing claim versions do not write", opts, async () => {
  await withIntegrationDb(async (base, f) => {
    const { db, proposalId, pm } = await seed(base, f, 3);
    assert.equal(await code(claimPlanEpics(db, { proposalId, actorId: pm, version: 2 })), "CONFLICT_VERSION");
    await base.aiProposal.update({ where: { id: proposalId }, data: { payload: { epicVersionWatermark: 2_147_483_644 } } });
    assert.equal(await code(claimPlanEpics(db, { proposalId, actorId: pm, version: 1 })), "CONFLICT_STATE");
    assert.equal((await row(base, proposalId, 0)).version, 1);
    await base.proposalEpic.update({ where: { proposalId_index: { proposalId, index: 2 } }, data: { expansionStatus: "DONE", tasks } });
    const claim = await claimPlanEpics(db, { proposalId, actorId: pm, version: 1 });
    assert.equal(claim.kind, "CLAIMED");
    if (claim.kind === "CLAIMED") assert.deepEqual(claim.targets.map(t => t.claimedVersion), [2_147_483_645, 2_147_483_646]);
    await base.aiProposal.update({ where: { id: proposalId }, data: { status: "APPROVED" } });
    assert.equal(await code(claimPlanEpics(db, { proposalId, actorId: pm, version: 1 })), "CONFLICT_STATE");
  });
});

test("W7c E18 E19 E20 stale claims are skipped, and no surviving claim rolls back", opts, async () => {
  await withIntegrationDb(async (base, f) => {
    const { db, proposalId, pm } = await seed(base, f, 3);
    const claim = await claimPlanEpics(db, { proposalId, actorId: pm, version: 1 });
    if (claim.kind !== "CLAIMED") throw new Error("expected claim");
    await base.proposalEpic.update({ where: { proposalId_index: { proposalId, index: 1 } }, data: { title: "edited", expansionStatus: "PENDING", version: { increment: 1 } } });
    const results = claim.targets.map(t => ({ index: t.index, claimedVersion: t.claimedVersion, tasks }));
    assert.deepEqual(await storePlanEpics(db, { proposalId, results, flagged: true }), { stored: 2, skipped: 1 });
    assert.equal((await row(base, proposalId, 1)).title, "edited");
    assert.equal((await base.aiProposal.findUniqueOrThrow({ where: { id: proposalId } })).flagged, true);
    await base.aiProposal.update({ where: { id: proposalId }, data: { flagged: false } });
    assert.equal(await code(storePlanEpics(db, { proposalId, results, flagged: true })), "CONFLICT_STATE");
    assert.equal((await base.aiProposal.findUniqueOrThrow({ where: { id: proposalId } })).flagged, false);
    await base.aiProposal.update({ where: { id: proposalId }, data: { status: "REJECTED" } });
    assert.equal(await code(storePlanEpics(db, { proposalId, results, flagged: true })), "CONFLICT_STATE");
  });
});

test("W7c E21 E22 failure marks only intact claims", opts, async () => {
  await withIntegrationDb(async (base, f) => {
    const { db, proposalId, pm } = await seed(base, f, 3);
    const claim = await claimPlanEpics(db, { proposalId, actorId: pm, version: 1 });
    if (claim.kind !== "CLAIMED") throw new Error("expected claim");
    await base.proposalEpic.update({ where: { proposalId_index: { proposalId, index: 1 } }, data: { expansionStatus: "PENDING", version: { increment: 1 } } });
    assert.equal(await failPlanEpics(db, { proposalId, claims: claim.targets, error: "TIMEOUT" }), 2);
    for (const index of [0, 2]) { const item = await row(base, proposalId, index); assert.deepEqual([item.expansionStatus, item.error, item.leaseExpiresAt, item.version], ["FAILED", "TIMEOUT", null, claim.targets[index].claimedVersion + 1]); }
    assert.equal((await row(base, proposalId, 1)).expansionStatus, "PENDING");
  });
});

test("W7c E11 E15 E21 empty done context, replayed edit version, and all claims failed", opts, async () => {
  await withIntegrationDb(async (base, f) => {
    const { db, proposalId, pm } = await seed(base, f, 3);
    const claim = await claimPlanEpics(db, { proposalId, actorId: pm, version: 1 });
    if (claim.kind !== "CLAIMED") throw new Error("expected claim");
    assert.deepEqual(claim.done, []);
    assert.equal(await failPlanEpics(db, { proposalId, claims: claim.targets, error: "FAILED" }), 3);
    for (const target of claim.targets) { const item = await row(base, proposalId, target.index); assert.deepEqual([item.expansionStatus, item.error, item.leaseExpiresAt, item.version], ["FAILED", "FAILED", null, target.claimedVersion + 1]); }
    await editEpic(db, { proposalId, actorId: pm, version: 1, index: 0, title: "Changed" });
    assert.equal(await code(claimPlanEpics(db, { proposalId, actorId: pm, version: 1 })), "CONFLICT_VERSION");
  });
});

test("W7c E19 shifted and newly added epics never receive an old claim", opts, async () => {
  await withIntegrationDb(async (base, f) => {
    const { db, proposalId, pm } = await seed(base, f, 3);
    const now = new Date("2026-11-10T00:00:00Z");
    const claim = await claimPlanEpics(db, { proposalId, actorId: pm, version: 1, now });
    if (claim.kind !== "CLAIMED") throw new Error("expected claim");
    await deleteEpic(db, { proposalId, actorId: pm, version: 1, index: 1, now: new Date(now.getTime() + EXPAND_LEASE_MS + 1) });
    await addEpic(db, { proposalId, actorId: pm, version: 2, title: "new", description: "d", checkpointName: null });
    const outcome = await storePlanEpics(db, { proposalId, results: claim.targets.map(t => ({ index: t.index, claimedVersion: t.claimedVersion, tasks })), flagged: false });
    assert.deepEqual(outcome, { stored: 1, skipped: 2 });
    assert.equal((await row(base, proposalId, 2)).title, "new");
    assert.equal((await row(base, proposalId, 2)).tasks, null);
  });
});

test("W7c E26 E27 parallel claims serialize after the proposal lock", opts, async () => {
  await withIntegrationDb(async (base, f) => {
    const { db, proposalId, pm } = await seed(base, f, 2);
    const hold = holdProposalLock(base, proposalId);
    await hold.locked;
    const first = claimPlanEpics(db, { proposalId, actorId: pm, version: 1 }).then(r => r.kind, e => (e as ProposalError).code);
    const second = claimPlanEpics(db, { proposalId, actorId: pm, version: 1 }).then(r => r.kind, e => (e as ProposalError).code);
    hold.release(); await hold.done;
    assert.deepEqual((await Promise.all([first, second])).sort(), ["CLAIMED", "CONFLICT_STATE"]);
    assert.equal(await code(claimEpic(db, { proposalId, actorId: pm, index: 0 })), "CONFLICT_STATE");
  });
});

test("W7c E27 an edit and a single claim serialize with bulk claiming", opts, async () => {
  await withIntegrationDb(async (base, f) => {
    const { db, proposalId, pm } = await seed(base, f, 3);
    await base.proposalEpic.update({ where: { proposalId_index: { proposalId, index: 1 } }, data: { expansionStatus: "DONE", tasks } });
    const hold = pauseAfterProposalLock(db);
    const bulk = claimPlanEpics(hold.db, { proposalId, actorId: pm, version: 1 });
    await hold.acquired;
    const edit = editEpic(db, { proposalId, actorId: pm, version: 1, index: 1, title: "Edited" });
    try { await waitForBlocked(base, f.applicationName); } finally { hold.release(); }
    assert.equal((await bulk).kind, "CLAIMED");
    assert.equal((await edit).epics[1].title, "Edited");

    const other = await seed(base, f, 2);
    const secondHold = pauseAfterProposalLock(other.db);
    const single = claimEpic(secondHold.db, { proposalId: other.proposalId, actorId: other.pm, index: 0 });
    await secondHold.acquired;
    const nextBulk = code(claimPlanEpics(other.db, { proposalId: other.proposalId, actorId: other.pm, version: 1 }));
    try { await waitForBlocked(base, f.applicationName); } finally { secondHold.release(); }
    assert.equal((await single).kind, "CLAIMED");
    assert.equal(await nextBulk, "CONFLICT_STATE");
  });
});

test("W7c E31 bulk lease is live through its exact expiry and is reclaimed afterwards", opts, async () => {
  await withIntegrationDb(async (base, f) => {
    const { db, proposalId, pm } = await seed(base, f, 2);
    const now = new Date("2026-11-10T00:00:00Z");
    const claim = await claimPlanEpics(db, { proposalId, actorId: pm, version: 1, now });
    assert.equal(claim.kind, "CLAIMED");
    assert.equal((await row(base, proposalId, 0)).leaseExpiresAt?.getTime(), now.getTime() + EXPAND_LEASE_MS);
    assert.equal(await code(claimPlanEpics(db, { proposalId, actorId: pm, version: 1, now: new Date(now.getTime() + EXPAND_LEASE_MS) })), "CONFLICT_STATE");
    assert.equal(await code(deleteEpic(db, { proposalId, actorId: pm, version: 1, index: 0, now: new Date(now.getTime() + EXPAND_LEASE_MS) })), "CONFLICT_STATE");
    assert.equal((await claimPlanEpics(db, { proposalId, actorId: pm, version: 1, now: new Date(now.getTime() + EXPAND_LEASE_MS + 1) })).kind, "CLAIMED");
    await deleteEpic(db, { proposalId, actorId: pm, version: 1, index: 0, now: new Date(now.getTime() + 2 * EXPAND_LEASE_MS + 2) });
  });
});

test("W7c E12 E13 all done returns fresh view; any live claim conflicts", opts, async () => {
  await withIntegrationDb(async (base, f) => {
    const { db, proposalId, pm, sessionId } = await seed(base, f, 2);
    await base.proposalEpic.updateMany({ where: { proposalId }, data: { expansionStatus: "DONE", tasks } });
    await base.aiSession.update({ where: { id: sessionId }, data: { outcome: "ABANDONED", endedAt: new Date() } });
    const beforeRows = await base.proposalEpic.findMany({ where: { proposalId }, orderBy: { index: "asc" } });
    const beforeProposal = await base.aiProposal.findUniqueOrThrow({ where: { id: proposalId } });
    const none = await claimPlanEpics(db, { proposalId, actorId: pm, version: 1 });
    assert.equal(none.kind, "NONE");
    if (none.kind === "NONE") {
      assert.equal(none.proposal.id, proposalId);
      assert.equal(none.proposal.version, 1);
      assert.deepEqual(none.proposal.epics.map(epic => epic.expansion.tasks), [tasks, tasks]);
    }
    assert.deepEqual(await base.proposalEpic.findMany({ where: { proposalId }, orderBy: { index: "asc" } }), beforeRows);
    const afterProposal = await base.aiProposal.findUniqueOrThrow({ where: { id: proposalId } });
    assert.deepEqual({ payload: afterProposal.payload, version: afterProposal.version, flagged: afterProposal.flagged }, { payload: beforeProposal.payload, version: beforeProposal.version, flagged: beforeProposal.flagged });
    await base.proposalEpic.update({ where: { proposalId_index: { proposalId, index: 0 } }, data: { expansionStatus: "IN_PROGRESS", leaseExpiresAt: new Date(Date.now() + 60_000) } });
    assert.equal(await code(claimPlanEpics(db, { proposalId, actorId: pm, version: 1 })), "CONFLICT_STATE");
    await base.proposalEpic.update({ where: { proposalId_index: { proposalId, index: 1 } }, data: { expansionStatus: "PENDING" } });
    assert.equal(await code(claimPlanEpics(db, { proposalId, actorId: pm, version: 1 })), "CONFLICT_STATE");
  });
});
