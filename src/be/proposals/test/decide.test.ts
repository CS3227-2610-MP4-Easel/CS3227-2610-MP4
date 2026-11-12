import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { applyPlan } from "@agile/core";
import { createDbClient } from "@agile/db";
import { createSessions } from "@agile/llm-gateway";
import { ProposalError, approveProposal, claimEpic, createProposal, getProposalView, rejectProposal, storeEpic, type DecideDeps, type EpicTask } from "../src/index.js";
import { integrationUrl, withIntegrationDb, type Fixtures } from "./fakes.js";

const opts = { skip: !integrationUrl };
const task = (n: number): EpicTask => ({ title: `Task ${n}`, description: "d", acceptanceCriteria: ["done"], storyPoints: 3 });
const core: DecideDeps["core"] = { applyPlan: (tx, projectId, plan, actorId) => applyPlan(tx as never, projectId, plan, actorId) };

type Closed = { sessionId: string; outcome: string; actorId: string };
function fakeSessions(fail = false) {
  const calls: Closed[] = [];
  const sessions: DecideDeps["sessions"] = {
    close: async (sessionId, outcome, actorId) => { calls.push({ sessionId, outcome, actorId }); if (fail) throw new Error("boom"); },
  };
  return { calls, sessions };
}

/** A proposal whose epics are in the given states (default: all DONE with 2 tasks each). */
async function seed(base: PrismaClient, f: Fixtures, opt: { epics?: number; checkpoints?: number; tasksPer?: number; states?: Array<"DONE" | "PENDING" | "FAILED" | "IN_PROGRESS"> } = {}) {
  const pm = await f.user();
  const project = await f.project(pm);
  await f.member(project, pm);
  const sessionId = await f.aiSession(pm, project);
  const db = createDbClient(base);
  const epicCount = opt.epics ?? 2;
  const checkpoints = Array.from({ length: opt.checkpoints ?? 1 }, (_, i) => ({ name: `CP ${i}`, targetDate: `2027-0${(i % 9) + 1}-15` }));
  const proposalId = await createProposal(db, {
    projectId: project, creatorId: pm, sessionId, flagged: false, approach: "a", checkpoints, retrieved: [],
    epics: Array.from({ length: epicCount }, (_, i) => ({ title: `Epic ${i}`, description: `d${i}`, checkpointName: checkpoints.length ? checkpoints[i % checkpoints.length].name : null })),
  });
  for (let i = 0; i < epicCount; i += 1) {
    const state = opt.states?.[i] ?? "DONE";
    if (state === "PENDING") continue;
    const claimed = await claimEpic(db, { proposalId, index: i, actorId: pm });
    if (claimed.kind !== "CLAIMED") throw new Error("seed claim");
    if (state === "DONE") await storeEpic(db, { proposalId, index: i, claimedVersion: claimed.claimedVersion, tasks: Array.from({ length: opt.tasksPer ?? 2 }, (_, t) => task(t)), flagged: false });
    if (state === "FAILED") await base.proposalEpic.update({ where: { proposalId_index: { proposalId, index: i } }, data: { expansionStatus: "FAILED", error: "X", leaseExpiresAt: null } });
  }
  return { pm, project, sessionId, db, proposalId };
}

const domainCounts = async (base: PrismaClient, projectId: string) => ({
  checkpoints: await base.checkpoint.count({ where: { projectId } }),
  epics: await base.epic.count({ where: { projectId } }),
  tasks: await base.task.count({ where: { projectId } }),
  events: await base.taskEvent.count({ where: { projectId } }),
});
const NONE = { checkpoints: 0, epics: 0, tasks: 0, events: 0 };
const proposalRow = (base: PrismaClient, id: string) => base.aiProposal.findUniqueOrThrow({ where: { id } });
const code = (promise: Promise<unknown>) => promise.then(() => "OK", (e: unknown) => (e instanceof ProposalError ? e.code : `OTHER:${String(e)}`));

async function assertUntouched(base: PrismaClient, projectId: string, proposalId: string, status = "PENDING", version = 1) {
  assert.deepEqual(await domainCounts(base, projectId), NONE);
  const row = await proposalRow(base, proposalId);
  assert.equal(row.status, status);
  assert.equal(row.version, version);
  assert.equal(row.appliedBy, null);
  assert.equal(row.appliedAt, null);
  assert.equal((row.payload as { applied?: unknown }).applied, undefined);
}

function holdProposalLock(base: PrismaClient, proposalId: string) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let locked!: () => void;
  const lockedPromise = new Promise<void>((resolve) => { locked = resolve; });
  const holder = { pid: 0 };
  const done = base.$transaction(async (tx) => {
    await tx.aiProposal.update({ where: { id: proposalId }, data: { updatedAt: new Date() } });
    const rows = await tx.$queryRaw<{ pid: number }[]>`select pg_backend_pid() as pid`;
    holder.pid = Number(rows[0].pid);
    locked();
    await gate;
  }, { timeout: 30_000 });
  done.catch(() => locked());
  return { release, locked: lockedPromise, done, holder };
}

/** Waits until at least `atLeast` backends are blocked (directly or through another blocked backend) by the holder's backend. */
async function waitForBlocked(base: PrismaClient, holderPid: number, atLeast: number): Promise<void> {
  for (let i = 0; i < 100; i += 1) {
    const rows = await base.$queryRaw<{ n: bigint }[]>`
      with recursive blocked(pid) as (
        select a.pid from pg_stat_activity a where ${holderPid}::int = any(pg_blocking_pids(a.pid))
        union
        select a.pid from pg_stat_activity a join blocked b on b.pid = any(pg_blocking_pids(a.pid))
      ) select count(*)::bigint as n from blocked`;
    if (Number(rows[0].n) >= atLeast) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error("transactions never blocked");
}

test("E30 approve with every epic DONE creates the plan, events, and closes the session ACCEPTED", opts, async () => {
  await withIntegrationDb(async (base, f) => {
    const { db, pm, project, proposalId, sessionId } = await seed(base, f, { epics: 3, checkpoints: 2, tasksPer: 2 });
    const { calls, sessions } = fakeSessions();
    const result = await approveProposal({ db, core, sessions }, { proposalId, version: 1, actorId: pm });
    assert.deepEqual(result, { proposalId, status: "APPROVED", created: { checkpoints: 2, epics: 3, tasks: 6 } });
    assert.deepEqual(await domainCounts(base, project), { checkpoints: 2, epics: 3, tasks: 6, events: 6 });
    assert.equal(await base.taskEvent.count({ where: { projectId: project, type: "CREATED" } }), 6);
    assert.deepEqual((await base.epic.findMany({ where: { projectId: project }, orderBy: { position: "asc" } })).map((e) => e.title), ["Epic 0", "Epic 1", "Epic 2"]);
    const row = await proposalRow(base, proposalId);
    assert.equal(row.status, "APPROVED");
    assert.equal(row.appliedBy, pm);
    assert.ok(row.appliedAt);
    assert.equal(row.version, 2);
    assert.deepEqual((row.payload as { applied: unknown }).applied, { checkpoints: 2, epics: 3, tasks: 6 });
    assert.equal((row.payload as { approach: unknown }).approach, "a");
    assert.deepEqual(calls, [{ sessionId, outcome: "ACCEPTED", actorId: pm }]);
  });
});

test("E31 approve with an epic PENDING, FAILED or IN_PROGRESS gives CONFLICT_STATE and creates nothing", opts, async () => {
  await withIntegrationDb(async (base, f) => {
    for (const bad of ["PENDING", "FAILED", "IN_PROGRESS"] as const) {
      const { db, pm, project, proposalId } = await seed(base, f, { epics: 2, states: ["DONE", bad] });
      const { calls, sessions } = fakeSessions();
      assert.equal(await code(approveProposal({ db, core, sessions }, { proposalId, version: 1, actorId: pm })), "CONFLICT_STATE", bad);
      await assertUntouched(base, project, proposalId);
      assert.equal(calls.length, 0);
    }
    // an IN_PROGRESS epic whose lease already passed still counts as not DONE
    const { db, pm, project, proposalId } = await seed(base, f, { epics: 1, states: ["IN_PROGRESS"] });
    await base.proposalEpic.update({ where: { proposalId_index: { proposalId, index: 0 } }, data: { leaseExpiresAt: new Date(Date.now() - 120_000) } });
    assert.equal(await code(approveProposal({ db, core, sessions: fakeSessions().sessions }, { proposalId, version: 1, actorId: pm })), "CONFLICT_STATE");
    await assertUntouched(base, project, proposalId);
  });
});

test("E32 approve repeated with the old and the new version returns the same result and creates no rows", opts, async () => {
  await withIntegrationDb(async (base, f) => {
    const { db, pm, project, proposalId, sessionId } = await seed(base, f);
    const { calls, sessions } = fakeSessions();
    const first = await approveProposal({ db, core, sessions }, { proposalId, version: 1, actorId: pm });
    const afterFirst = await domainCounts(base, project);
    const oldVersion = await approveProposal({ db, core, sessions }, { proposalId, version: 1, actorId: pm });
    const newVersion = await approveProposal({ db, core, sessions }, { proposalId, version: 2, actorId: pm });
    assert.deepEqual(oldVersion, first);
    assert.deepEqual(newVersion, first);
    assert.deepEqual(await domainCounts(base, project), afterFirst);
    assert.equal((await proposalRow(base, proposalId)).version, 2);
    assert.equal(calls.length, 3);
    assert.ok(calls.every((c) => c.sessionId === sessionId && c.outcome === "ACCEPTED"));
  });
});

test("E34 stale versions: PENDING -> CONFLICT_VERSION (also with an unfinished epic); REJECTED and SUPERSEDED -> CONFLICT_STATE; nothing created", opts, async () => {
  await withIntegrationDb(async (base, f) => {
    const a = await seed(base, f);
    const deps = (db: typeof a.db) => ({ db, core, sessions: fakeSessions().sessions });
    assert.equal(await code(approveProposal(deps(a.db), { proposalId: a.proposalId, version: 7, actorId: a.pm })), "CONFLICT_VERSION");
    await assertUntouched(base, a.project, a.proposalId);

    const b = await seed(base, f, { epics: 2, states: ["DONE", "PENDING"] });
    assert.equal(await code(approveProposal(deps(b.db), { proposalId: b.proposalId, version: 7, actorId: b.pm })), "CONFLICT_VERSION");
    await assertUntouched(base, b.project, b.proposalId);

    const c = await seed(base, f);
    await rejectProposal({ db: c.db, sessions: fakeSessions().sessions }, { proposalId: c.proposalId, version: 1, actorId: c.pm });
    assert.equal(await code(approveProposal(deps(c.db), { proposalId: c.proposalId, version: 1, actorId: c.pm })), "CONFLICT_STATE");
    assert.equal(await code(approveProposal(deps(c.db), { proposalId: c.proposalId, version: 99, actorId: c.pm })), "CONFLICT_STATE");
    assert.deepEqual(await domainCounts(base, c.project), NONE);

    const d = await seed(base, f);
    await base.aiProposal.update({ where: { id: d.proposalId }, data: { status: "SUPERSEDED" } });
    assert.equal(await code(approveProposal(deps(d.db), { proposalId: d.proposalId, version: 1, actorId: d.pm })), "CONFLICT_STATE");
    assert.equal(await code(approveProposal(deps(d.db), { proposalId: d.proposalId, version: 5, actorId: d.pm })), "CONFLICT_STATE");
    await assertUntouched(base, d.project, d.proposalId, "SUPERSEDED", 1);
  });
});

test("E35 approve of a REJECTED proposal gives CONFLICT_STATE", opts, async () => {
  await withIntegrationDb(async (base, f) => {
    const { db, pm, project, proposalId } = await seed(base, f);
    await rejectProposal({ db, sessions: fakeSessions().sessions }, { proposalId, version: 1, actorId: pm });
    const { calls, sessions } = fakeSessions();
    assert.equal(await code(approveProposal({ db, core, sessions }, { proposalId, version: 2, actorId: pm })), "CONFLICT_STATE");
    assert.equal(calls.length, 0);
    await assertUntouched(base, project, proposalId, "REJECTED", 2);
  });
});

test("approve of an unknown proposal gives NOT_FOUND", opts, async () => {
  await withIntegrationDb(async (base, f) => {
    const { db, pm } = await seed(base, f);
    assert.equal(await code(approveProposal({ db, core, sessions: fakeSessions().sessions }, { proposalId: randomUUID(), version: 1, actorId: pm })), "NOT_FOUND");
  });
});

test("approve maps NotMember to NOT_FOUND and a non-PM to FORBIDDEN_ROLE and rolls back", opts, async () => {
  await withIntegrationDb(async (base, f) => {
    const { db, project, proposalId } = await seed(base, f);
    const outsider = await f.user("PM");
    const dev = await f.user("DEVELOPER");
    await f.member(project, dev);
    const deps = { db, core, sessions: fakeSessions().sessions };
    assert.equal(await code(approveProposal(deps, { proposalId, version: 1, actorId: outsider })), "NOT_FOUND");
    assert.equal(await code(approveProposal(deps, { proposalId, version: 1, actorId: dev })), "FORBIDDEN_ROLE");
    await assertUntouched(base, project, proposalId);
  });
});

test("E37 the events insert in applyPlan throws: the transaction rolls back, proposal PENDING at its old version, no domain rows", opts, async () => {
  await withIntegrationDb(async (base, f) => {
    const { db, pm, project, proposalId } = await seed(base, f);
    const { calls, sessions } = fakeSessions();
    const failingCore: DecideDeps["core"] = {
      applyPlan: (tx, projectId, plan, actorId) => {
        const wrapped = new Proxy(tx as object, {
          get(target, property, receiver) {
            if (property === "taskEvent") return { ...(Reflect.get(target, property, receiver) as object), createMany: async () => { throw new Error("injected events failure"); } };
            return Reflect.get(target, property, receiver);
          },
        });
        return applyPlan(wrapped as never, projectId, plan, actorId);
      },
    };
    await assert.rejects(approveProposal({ db, core: failingCore, sessions }, { proposalId, version: 1, actorId: pm }), { message: "injected events failure" });
    await assertUntouched(base, project, proposalId);
    assert.equal(calls.length, 0);
    // the same proposal can still be approved afterwards
    const ok = await approveProposal({ db, core, sessions }, { proposalId, version: 1, actorId: pm });
    assert.equal(ok.created.tasks, 4);
  });
});

test("E42 reject: PENDING -> REJECTED with session REJECTED; again and after APPROVED -> CONFLICT_STATE; stale version -> CONFLICT_VERSION", opts, async () => {
  await withIntegrationDb(async (base, f) => {
    const a = await seed(base, f);
    const { calls, sessions } = fakeSessions();
    const view = await rejectProposal({ db: a.db, sessions }, { proposalId: a.proposalId, version: 1, actorId: a.pm });
    assert.equal(view.status, "REJECTED");
    assert.equal(view.version, 2);
    assert.equal(view.id, a.proposalId);
    assert.deepEqual(calls, [{ sessionId: a.sessionId, outcome: "REJECTED", actorId: a.pm }]);
    assert.equal(await code(rejectProposal({ db: a.db, sessions }, { proposalId: a.proposalId, version: 2, actorId: a.pm })), "CONFLICT_STATE");
    assert.equal(await code(rejectProposal({ db: a.db, sessions }, { proposalId: a.proposalId, version: 1, actorId: a.pm })), "CONFLICT_STATE");
    assert.equal((await proposalRow(base, a.proposalId)).version, 2);
    assert.equal(calls.length, 1);

    const b = await seed(base, f);
    await approveProposal({ db: b.db, core, sessions }, { proposalId: b.proposalId, version: 1, actorId: b.pm });
    const counts = await domainCounts(base, b.project);
    assert.equal(await code(rejectProposal({ db: b.db, sessions }, { proposalId: b.proposalId, version: 2, actorId: b.pm })), "CONFLICT_STATE");
    assert.equal((await proposalRow(base, b.proposalId)).status, "APPROVED");
    assert.deepEqual(await domainCounts(base, b.project), counts);

    const c = await seed(base, f);
    assert.equal(await code(rejectProposal({ db: c.db, sessions }, { proposalId: c.proposalId, version: 9, actorId: c.pm })), "CONFLICT_VERSION");
    await assertUntouched(base, c.project, c.proposalId);
    assert.equal(await code(rejectProposal({ db: c.db, sessions }, { proposalId: randomUUID(), version: 1, actorId: c.pm })), "NOT_FOUND");
  });
});

test("E43 after a reject, expand and approve both give CONFLICT_STATE", opts, async () => {
  await withIntegrationDb(async (base, f) => {
    const { db, pm, project, proposalId } = await seed(base, f, { epics: 2, states: ["DONE", "PENDING"] });
    const { sessions } = fakeSessions();
    await rejectProposal({ db, sessions }, { proposalId, version: 1, actorId: pm });
    assert.equal(await code(claimEpic(db, { proposalId, index: 1, actorId: pm })), "CONFLICT_STATE");
    assert.equal((await base.proposalEpic.findUniqueOrThrow({ where: { proposalId_index: { proposalId, index: 1 } } })).expansionStatus, "PENDING");
    assert.equal(await code(approveProposal({ db, core, sessions }, { proposalId, version: 2, actorId: pm })), "CONFLICT_STATE");
    await assertUntouched(base, project, proposalId, "REJECTED", 2);
  });
});

test("E44 Sessions.close throws after commit: the call still succeeds and only the session id is warned", opts, async () => {
  await withIntegrationDb(async (base, f) => {
    const { db, pm, project, proposalId, sessionId } = await seed(base, f);
    const warn = mock.method(console, "warn", () => undefined);
    try {
      const { calls, sessions } = fakeSessions(true);
      const result = await approveProposal({ db, core, sessions }, { proposalId, version: 1, actorId: pm });
      assert.equal(result.status, "APPROVED");
      assert.equal(calls.length, 1);
      assert.deepEqual(warn.mock.calls.map((c) => c.arguments), [["pm_session_close_failed", { sessionId }]]);
      assert.equal((await domainCounts(base, project)).tasks, 4);
      assert.equal((await proposalRow(base, proposalId)).status, "APPROVED");

      const other = await seed(base, f);
      const rejected = await rejectProposal({ db: other.db, sessions: fakeSessions(true).sessions }, { proposalId: other.proposalId, version: 1, actorId: other.pm });
      assert.equal(rejected.status, "REJECTED");
      assert.deepEqual(warn.mock.calls[1].arguments, ["pm_session_close_failed", { sessionId: other.sessionId }]);
    } finally {
      warn.mock.restore();
    }
  });
});

test("a replayed approve without a stored applied count falls back to counting the stored rows", opts, async () => {
  await withIntegrationDb(async (base, f) => {
    const { db, pm, proposalId } = await seed(base, f, { epics: 2, checkpoints: 1, tasksPer: 3 });
    const sessions = fakeSessions().sessions;
    await approveProposal({ db, core, sessions }, { proposalId, version: 1, actorId: pm });
    const row = await proposalRow(base, proposalId);
    const { applied: _applied, ...rest } = row.payload as Record<string, unknown>;
    await base.aiProposal.update({ where: { id: proposalId }, data: { payload: rest as never } });
    const replay = await approveProposal({ db, core, sessions }, { proposalId, version: 2, actorId: pm });
    assert.deepEqual(replay, { proposalId, status: "APPROVED", created: { checkpoints: 1, epics: 2, tasks: 6 } });
  });
});

test("E33 two concurrent approves (barrier): one applies, the other waits and returns the same result; one set of rows", opts, async () => {
  await withIntegrationDb(async (base, f) => {
    const { db, pm, project, proposalId } = await seed(base, f, { epics: 2, checkpoints: 1, tasksPer: 3 });
    const { calls, sessions } = fakeSessions();
    const hold = holdProposalLock(base, proposalId);
    let both: Promise<[unknown, unknown]> | undefined;
    try {
      await hold.locked;
      both = Promise.all([
        approveProposal({ db, core, sessions }, { proposalId, version: 1, actorId: pm }),
        approveProposal({ db, core, sessions }, { proposalId, version: 1, actorId: pm }),
      ]);
      both.catch(() => undefined);
      await waitForBlocked(base, hold.holder.pid, 2);
    } finally {
      hold.release();
    }
    await hold.done;
    const [first, second] = (await both) as [unknown, unknown];
    assert.deepEqual(first, second);
    assert.deepEqual(first, { proposalId, status: "APPROVED", created: { checkpoints: 1, epics: 2, tasks: 6 } });
    assert.deepEqual(await domainCounts(base, project), { checkpoints: 1, epics: 2, tasks: 6, events: 6 });
    assert.equal((await proposalRow(base, proposalId)).version, 2);
    assert.equal(calls.length, 2);
  });
});

for (const [firstName, order] of [["approve", ["approve", "reject"]], ["reject", ["reject", "approve"]]] as const) {
  test(`E48 approve and reject sent together (barrier, ${firstName} queued first): exactly one wins, the loser gets CONFLICT_STATE`, opts, async () => {
    await withIntegrationDb(async (base, f) => {
      const { db, pm, project, proposalId } = await seed(base, f);
      const { calls, sessions } = fakeSessions();
      const run = {
        approve: () => approveProposal({ db, core, sessions }, { proposalId, version: 1, actorId: pm }),
        reject: () => rejectProposal({ db, sessions }, { proposalId, version: 1, actorId: pm }),
      };
      const hold = holdProposalLock(base, proposalId);
      const results: Promise<string>[] = [];
      try {
        await hold.locked;
        results.push(code(run[order[0]]()));
        await waitForBlocked(base, hold.holder.pid, 1);
        results.push(code(run[order[1]]()));
        await waitForBlocked(base, hold.holder.pid, 2);
      } finally {
        hold.release();
      }
      await hold.done;
      const [winner, loser] = await Promise.all(results);
      assert.equal(winner, "OK");
      assert.equal(loser, "CONFLICT_STATE");
      const row = await proposalRow(base, proposalId);
      assert.equal(row.version, 2);
      assert.equal(calls.length, 1);
      if (order[0] === "reject") {
        assert.equal(row.status, "REJECTED");
        assert.deepEqual(await domainCounts(base, project), NONE);
        assert.equal(calls[0].outcome, "REJECTED");
      } else {
        assert.equal(row.status, "APPROVED");
        assert.deepEqual(await domainCounts(base, project), { checkpoints: 1, epics: 2, tasks: 4, events: 4 });
        assert.equal(calls[0].outcome, "ACCEPTED");
      }
    });
  });
}

test("E53 approving a maximum plan (8 checkpoints, 10 epics, 80 tasks) takes at most 10 write statements besides the locks", opts, async (t) => {
  const logged = new PrismaClient({ adapter: new PrismaPg({ connectionString: integrationUrl }), log: [{ emit: "event", level: "query" }] });
  try {
    await withIntegrationDb(async (base, f) => {
      const { pm, project, proposalId } = await seed(base, f, { epics: 10, checkpoints: 8, tasksPer: 8 });
      const db = createDbClient(logged);
      const statements: string[] = [];
      let capture = false;
      (logged as unknown as { $on(event: "query", cb: (e: { query: string }) => void): void }).$on("query", (e) => { if (capture) statements.push(e.query); });
      const started = Date.now();
      capture = true;
      const result = await approveProposal({ db, core, sessions: fakeSessions().sessions }, { proposalId, version: 1, actorId: pm });
      capture = false;
      const elapsed = Date.now() - started;
      assert.deepEqual(result.created, { checkpoints: 8, epics: 10, tasks: 80 });
      assert.deepEqual(await domainCounts(base, project), { checkpoints: 8, epics: 10, tasks: 80, events: 80 });
      const writes = statements.filter((s) => /^\s*(INSERT|UPDATE)\b/i.test(s));
      const locks = writes.filter((s) => /^\s*UPDATE .* SET "updated_at" = \$1 WHERE/.test(s));
      t.diagnostic(`write statements ${writes.length} (lock updates ${locks.length}); all statements ${statements.length}; ${elapsed} ms`);
      assert.equal(locks.length, 2, `lock statements: ${locks.length} of ${writes.length} writes`);
      assert.ok(writes.length - locks.length <= 10, `${writes.length - locks.length} writes besides the locks`);
    });
  } finally {
    await logged.$disconnect();
  }
});

test("E56 approve after the session went idle over 30 minutes succeeds and the session stays ABANDONED", opts, async () => {
  await withIntegrationDb(async (base, f) => {
    const { db, pm, project, proposalId, sessionId } = await seed(base, f);
    const sessions = createSessions({ db: base, settings: { tier: "test" } });
    await base.aiSession.update({ where: { id: sessionId }, data: { lastActivityAt: new Date(Date.now() - 31 * 60_000) } });
    await assert.rejects(sessions.assertUsable(sessionId, pm, "PM_PLAN_OUTLINE"), { message: "CONFLICT_STATE" });
    assert.equal((await base.aiSession.findUniqueOrThrow({ where: { id: sessionId } })).outcome, "ABANDONED");
    const result = await approveProposal({ db, core, sessions }, { proposalId, version: 1, actorId: pm });
    assert.equal(result.status, "APPROVED");
    assert.equal((await domainCounts(base, project)).tasks, 4);
    assert.equal((await base.aiSession.findUniqueOrThrow({ where: { id: sessionId } })).outcome, "ABANDONED");
    assert.equal((await getProposalView(db, proposalId, pm))?.status, "APPROVED");
  });
});
