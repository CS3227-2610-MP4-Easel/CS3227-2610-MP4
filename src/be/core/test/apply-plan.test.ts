import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NotMember } from "@agile/contracts";
import { createDbClient } from "@agile/db";
import type { PrismaClient } from "@prisma/client";
import { applyPlan, countPlan, PlanInputSchema, type PlanInput } from "../src/index.js";
import { integrationUrl, withIntegrationDb } from "./fakes.js";

const task = { title: "T", description: "d", acceptanceCriteria: ["a"], storyPoints: 3 as const };
function plan(over: Partial<PlanInput> = {}): PlanInput {
  return {
    checkpoints: [{ name: "Alpha", targetDate: "2027-01-31" }, { name: "Beta", targetDate: "2027-03-01" }],
    epics: [
      { title: "E1", description: "", checkpointName: "Alpha", tasks: [task, { ...task, title: "T2" }] },
      { title: "E2", description: "", checkpointName: null, tasks: [task] },
    ],
    ...over,
  };
}

describe("PlanInputSchema and countPlan", () => {
  it("accepts a valid plan and counts it", () => {
    const parsed = PlanInputSchema.parse(plan());
    assert.deepEqual(countPlan(parsed), { checkpoints: 2, epics: 2, tasks: 3 });
  });

  it("E38 rejects each bad plan for its intended reason", () => {
    const base = plan();
    const bad: Array<[string, unknown, string]> = [
      ["unknown checkpoint name", { ...base, epics: [{ ...base.epics[0], checkpointName: "Nope" }] }, "custom@epics.0.checkpointName"],
      ["case-duplicate names", { ...base, checkpoints: [{ name: "Alpha", targetDate: "2027-01-31" }, { name: "alpha", targetDate: "2027-02-01" }] }, "custom@checkpoints.1.name"],
      ["11 epics", { ...base, epics: Array.from({ length: 11 }, () => base.epics[1]) }, "too_big@epics"],
      ["4 points", { ...base, epics: [{ ...base.epics[1], tasks: [{ ...task, storyPoints: 4 }] }] }, "invalid_union@epics.0.tasks.0.storyPoints"],
      ["unknown projectId key", { ...base, projectId: "x" }, "unrecognized_keys@"],
      ["unknown assigneeId key", { ...base, epics: [{ ...base.epics[1], tasks: [{ ...task, assigneeId: "x" }] }] }, "unrecognized_keys@epics.0.tasks.0"],
      ["impossible date", { ...base, checkpoints: [{ name: "Alpha", targetDate: "2027-02-30" }], epics: [{ ...base.epics[1] }] }, "custom@checkpoints.0.targetDate"],
    ];
    for (const [label, candidate, expected] of bad) {
      const result = PlanInputSchema.safeParse(candidate);
      assert.equal(result.success, false, label);
      if (result.success) continue;
      const found = result.error.issues.map((issue) => `${issue.code}@${issue.path.join(".")}`);
      assert.ok(found.includes(expected), `${label}: expected ${expected}, got ${found.join(", ")}`);
    }
  });

  it("E38 positive controls: boundary plans are accepted", () => {
    const base = plan();
    const eight = Array.from({ length: 8 }, () => task);
    const accepted: Array<[string, unknown]> = [
      ["10 epics", { ...base, epics: Array.from({ length: 10 }, (_, i) => ({ ...base.epics[1], title: `E${i}` })) }],
      ["9 epics", { ...base, epics: Array.from({ length: 9 }, (_, i) => ({ ...base.epics[1], title: `E${i}` })) }],
      ["8 checkpoints", { ...base, checkpoints: Array.from({ length: 8 }, (_, i) => ({ name: `C${i}`, targetDate: "2027-01-31" })), epics: [base.epics[1]] }],
      ["8 tasks per epic", { ...base, epics: [{ ...base.epics[1], tasks: eight }] }],
      ["13-point task", { ...base, epics: [{ ...base.epics[1], tasks: [{ ...task, storyPoints: 13 }] }] }],
      ["MVP and Beta names", { ...base, checkpoints: [{ name: "MVP", targetDate: "2027-01-31" }, { name: "Beta", targetDate: "2027-03-01" }], epics: [{ ...base.epics[1], checkpointName: "MVP" }] }],
    ];
    for (const [label, candidate] of accepted) {
      const result = PlanInputSchema.safeParse(candidate);
      assert.equal(result.success, true, `${label}: ${result.success ? "" : JSON.stringify(result.error.issues)}`);
    }
  });

  it("E38 applyPlan throws INVALID_PLAN before touching the database", async () => {
    const tx = new Proxy({}, { get() { throw new Error("db touched"); } });
    await assert.rejects(applyPlan(tx as never, "p", { ...plan(), projectId: "x" }, "u"), /INVALID_PLAN/);
  });
});

describe("applyPlan against the database", { skip: !integrationUrl }, () => {
  async function assertNothingWritten(base: PrismaClient, projectId: string): Promise<void> {
    assert.equal(await base.epic.count({ where: { projectId } }), 0);
    assert.equal(await base.checkpoint.count({ where: { projectId } }), 0);
    assert.equal(await base.task.count({ where: { projectId } }), 0);
    assert.equal(await base.taskEvent.count({ where: { projectId } }), 0);
  }

  for (const [label, expected] of [["a non-member", NotMember], ["a DEV_LEAD", /FORBIDDEN_ROLE/], ["an archived project", /CONFLICT_STATE/]] as const) {
    it(`E39 refuses ${label}, writing nothing and rolling back the lock update`, async () => {
      await withIntegrationDb(async (base, f) => {
        const db = createDbClient(base);
        const pm = await f.user("PM");
        const projectId = await f.project(pm);
        await f.member(projectId, pm);
        let actor = pm;
        if (label === "a non-member") actor = await f.user("PM");
        if (label === "a DEV_LEAD") {
          actor = await f.user("DEV_LEAD");
          await f.member(projectId, actor);
        }
        if (label === "an archived project") await base.project.update({ where: { id: projectId }, data: { status: "ARCHIVED" } });
        const before = await base.project.findUniqueOrThrow({ where: { id: projectId } });
        await assert.rejects(db.$transaction((tx) => applyPlan(tx, projectId, plan(), actor)), expected);
        const after = await base.project.findUniqueOrThrow({ where: { id: projectId } });
        assert.equal(after.status, before.status);
        assert.equal(after.updatedAt.getTime(), before.updatedAt.getTime());
        await assertNothingWritten(base, projectId);
      });
    });
  }

  it("E40 numbers new epics after the visible maximum, ignoring soft-deleted rows", async () => {
    await withIntegrationDb(async (base, f) => {
      const db = createDbClient(base);
      const pm = await f.user("PM");
      const projectId = await f.project(pm);
      await f.member(projectId, pm);
      for (let position = 0; position < 5; position++) await base.epic.create({ data: { projectId, title: `old${position}`, position } });
      const goneBefore = await base.epic.create({ data: { projectId, title: "gone", position: 9, deletedAt: new Date() } });
      await db.$transaction((tx) => applyPlan(tx, projectId, plan(), pm));
      const created = await base.epic.findMany({ where: { projectId, title: { in: ["E1", "E2"] } }, orderBy: { position: "asc" } });
      assert.deepEqual(created.map((e) => [e.title, e.position]), [["E1", 5], ["E2", 6]]);
      const [e1, e2] = created;
      assert.ok(e1 && e2);
      const tasks = await base.task.findMany({ where: { projectId }, include: { events: true }, orderBy: { title: "asc" } });
      assert.equal(tasks.length, 3);
      // plan(): E1 has tasks "T" and "T2", E2 has "T"; sort by epic then title.
      const byEpic = (epicId: string) => tasks.filter((t) => t.epicId === epicId).map((t) => t.title);
      assert.deepEqual(byEpic(e1.id), ["T", "T2"]);
      assert.deepEqual(byEpic(e2.id), ["T"]);
      for (const t of tasks) {
        assert.equal(t.description, "d");
        assert.deepEqual(t.acceptanceCriteria, ["a"]);
        assert.equal(t.storyPoints, 3);
        assert.equal(t.createdBy, pm);
        assert.equal(t.version, 1);
        assert.equal(t.status, "TODO");
        assert.equal(t.events.length, 1);
        const event = t.events[0];
        assert.equal(event?.taskId, t.id);
        assert.equal(event?.type, "CREATED");
        assert.equal(event?.fromValue, null);
        assert.equal(event?.toValue, "TODO");
        assert.equal(event?.actorId, pm);
      }
      const checkpoints = await base.checkpoint.findMany({ where: { projectId }, orderBy: { name: "asc" } });
      assert.deepEqual(checkpoints.map((c) => [c.name, c.targetDate.toISOString(), c.version]), [
        ["Alpha", "2027-01-31T00:00:00.000Z", 1],
        ["Beta", "2027-03-01T00:00:00.000Z", 1],
      ]);
      assert.equal(e1.checkpointId, checkpoints[0]?.id);
      assert.equal(e2.checkpointId, null);
      const goneAfter = await base.epic.findUniqueOrThrow({ where: { id: goneBefore.id } });
      assert.deepEqual(goneAfter, goneBefore);
      assert.equal(await base.taskEvent.count({ where: { projectId } }), 3);
    });
  });

  it("E41 creates epics with a null checkpoint when the plan has no checkpoints", async () => {
    await withIntegrationDb(async (base, f) => {
      const db = createDbClient(base);
      const pm = await f.user("PM");
      const projectId = await f.project(pm);
      await f.member(projectId, pm);
      const noCheckpoints = plan({ checkpoints: [], epics: [{ title: "E1", description: "", checkpointName: null, tasks: [task] }] });
      await db.$transaction((tx) => applyPlan(tx, projectId, noCheckpoints, pm));
      const epics = await base.epic.findMany({ where: { projectId } });
      assert.equal(epics.length, 1);
      assert.equal(epics[0]?.checkpointId, null);
      assert.equal(epics[0]?.position, 0);
      assert.equal(await base.checkpoint.count({ where: { projectId } }), 0);
      assert.equal(await base.task.count({ where: { projectId, epicId: epics[0]?.id } }), 1);
      assert.equal(await base.taskEvent.count({ where: { projectId } }), 1);
    });
  });

  it("E54 a count that disagrees with the inserts rolls the whole transaction back", async () => {
    await withIntegrationDb(async (base, f) => {
      const db = createDbClient(base);
      const pm = await f.user("PM");
      const projectId = await f.project(pm);
      await f.member(projectId, pm);
      const wrong = () => ({ checkpoints: 2, epics: 2, tasks: 4 });
      await assert.rejects(db.$transaction((tx) => applyPlan(tx, projectId, plan(), pm, { count: wrong })), /INVALID_PLAN/);
      assert.equal(await base.epic.count({ where: { projectId } }), 0);
      assert.equal(await base.checkpoint.count({ where: { projectId } }), 0);
      assert.equal(await base.task.count({ where: { projectId } }), 0);
      assert.equal(await base.taskEvent.count({ where: { projectId } }), 0);
    });
  });

  it("E55 archive committed first makes applyPlan wait on the project lock then throw CONFLICT_STATE", async () => {
    await withIntegrationDb(async (base, f) => {
      const db = createDbClient(base);
      const pm = await f.user("PM");
      const projectId = await f.project(pm);
      await f.member(projectId, pm);
      let releaseA!: () => void;
      const hold = new Promise<void>((resolve) => { releaseA = resolve; });
      let archived!: () => void;
      const archivedSignal = new Promise<void>((resolve) => { archived = resolve; });
      const a = base.$transaction(async (tx) => {
        await tx.project.update({ where: { id: projectId }, data: { status: "ARCHIVED" } });
        archived();
        await hold;
      });
      let b: Promise<string> | undefined;
      try {
        await Promise.race([archivedSignal, a]);
        let settled = false;
        b = db.$transaction((tx) => applyPlan(tx, projectId, plan(), pm)).then(() => "ok", (error: Error) => error.message).finally(() => { settled = true; });
        await new Promise((resolve) => setTimeout(resolve, 500));
        assert.equal(settled, false, "applyPlan must wait on the project row lock");
      } finally {
        releaseA();
        await Promise.allSettled([a, b]);
      }
      await a;
      assert.equal(await b, "CONFLICT_STATE");
      assert.equal(await base.epic.count({ where: { projectId } }), 0);
      assert.equal(await base.task.count({ where: { projectId } }), 0);
      assert.equal(await base.taskEvent.count({ where: { projectId } }), 0);
    });
  });

  it("E55 applyPlan committed first leaves its rows and the archive follows", async () => {
    await withIntegrationDb(async (base, f) => {
      const db = createDbClient(base);
      const pm = await f.user("PM");
      const projectId = await f.project(pm);
      await f.member(projectId, pm);
      // The transaction keeps the project lock after applyPlan has inserted, until the gate opens.
      let open!: () => void;
      const gate = new Promise<void>((resolve) => { open = resolve; });
      let inserted!: () => void;
      const insertedSignal = new Promise<void>((resolve) => { inserted = resolve; });
      const b = db.$transaction(async (tx) => {
        await applyPlan(tx, projectId, plan(), pm, { count: (parsed) => { inserted(); return countPlan(parsed); } });
        await gate;
      });
      let archive: Promise<unknown> | undefined;
      try {
        await Promise.race([insertedSignal, b]);
        let archiveSettled = false;
        archive = base.$transaction((tx) => tx.project.update({ where: { id: projectId }, data: { status: "ARCHIVED" } })).finally(() => { archiveSettled = true; });
        await new Promise((resolve) => setTimeout(resolve, 500));
        assert.equal(archiveSettled, false, "the archive must wait for applyPlan's transaction");
      } finally {
        open();
        await Promise.allSettled([b, archive]);
      }
      await b;
      await archive;
      assert.equal(await base.epic.count({ where: { projectId } }), 2);
      assert.equal(await base.task.count({ where: { projectId } }), 3);
      assert.equal(await base.taskEvent.count({ where: { projectId } }), 3);
      assert.equal((await base.project.findUniqueOrThrow({ where: { id: projectId } })).status, "ARCHIVED");
    });
  });
});
