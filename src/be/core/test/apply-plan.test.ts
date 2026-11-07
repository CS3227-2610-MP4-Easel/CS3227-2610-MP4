import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NotMember } from "@agile/contracts";
import { createDbClient } from "@agile/db";
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

  it("E38 rejects unknown checkpoint names, case-duplicate names, 11 epics, 4 points and unknown keys", () => {
    const base = plan();
    const bad: unknown[] = [
      { ...base, epics: [{ ...base.epics[0], checkpointName: "Nope" }] },
      { ...base, checkpoints: [{ name: "Alpha", targetDate: "2027-01-31" }, { name: "alpha", targetDate: "2027-02-01" }] },
      { ...base, epics: Array.from({ length: 11 }, () => base.epics[1]) },
      { ...base, epics: [{ ...base.epics[1], tasks: [{ ...task, storyPoints: 4 }] }] },
      { ...base, projectId: "x" },
      { ...base, epics: [{ ...base.epics[1], tasks: [{ ...task, assigneeId: "x" }] }] },
      { ...base, checkpoints: [{ name: "Alpha", targetDate: "2027-02-30" }] },
    ];
    for (const candidate of bad) assert.equal(PlanInputSchema.safeParse(candidate).success, false);
  });

  it("E38 applyPlan throws INVALID_PLAN before touching the database", async () => {
    const tx = new Proxy({}, { get() { throw new Error("db touched"); } });
    await assert.rejects(applyPlan(tx as never, "p", { ...plan(), projectId: "x" }, "u"), /INVALID_PLAN/);
  });
});

describe("applyPlan against the database", { skip: !integrationUrl }, () => {
  it("E39 refuses a non-member, a DEV_LEAD and an archived project, writing nothing", async () => {
    await withIntegrationDb(async (base, f) => {
      const db = createDbClient(base);
      const pm = await f.user("PM");
      const outsider = await f.user("PM");
      const lead = await f.user("DEV_LEAD");
      const projectId = await f.project(pm);
      await f.member(projectId, pm);
      await f.member(projectId, lead);
      await assert.rejects(db.$transaction((tx) => applyPlan(tx, projectId, plan(), outsider)), NotMember);
      await assert.rejects(db.$transaction((tx) => applyPlan(tx, projectId, plan(), lead)), /FORBIDDEN_ROLE/);
      await base.project.update({ where: { id: projectId }, data: { status: "ARCHIVED" } });
      await assert.rejects(db.$transaction((tx) => applyPlan(tx, projectId, plan(), pm)), /CONFLICT_STATE/);
      assert.equal(await base.epic.count({ where: { projectId } }), 0);
      assert.equal(await base.checkpoint.count({ where: { projectId } }), 0);
      assert.equal(await base.task.count({ where: { projectId } }), 0);
    });
  });

  it("E40 numbers new epics after the visible maximum, ignoring soft-deleted rows", async () => {
    await withIntegrationDb(async (base, f) => {
      const db = createDbClient(base);
      const pm = await f.user("PM");
      const projectId = await f.project(pm);
      await f.member(projectId, pm);
      for (let position = 0; position < 5; position++) await base.epic.create({ data: { projectId, title: `old${position}`, position } });
      await base.epic.create({ data: { projectId, title: "gone", position: 9, deletedAt: new Date() } });
      await db.$transaction((tx) => applyPlan(tx, projectId, plan(), pm));
      const created = await base.epic.findMany({ where: { projectId, title: { in: ["E1", "E2"] } }, orderBy: { position: "asc" } });
      assert.deepEqual(created.map((e) => [e.title, e.position]), [["E1", 5], ["E2", 6]]);
      const tasks = await base.task.findMany({ where: { projectId }, include: { events: true } });
      assert.equal(tasks.length, 3);
      assert.ok(tasks.every((t) => t.status === "TODO" && t.events.length === 1 && t.events[0]?.type === "CREATED" && t.events[0].toValue === "TODO" && t.events[0].actorId === pm));
      const alpha = await base.checkpoint.findFirstOrThrow({ where: { projectId, name: "Alpha" } });
      assert.equal(created[0]?.checkpointId, alpha.id);
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
      assert.equal(await base.checkpoint.count({ where: { projectId } }), 0);
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
      await archivedSignal;
      let settled = false;
      const b = db.$transaction((tx) => applyPlan(tx, projectId, plan(), pm)).then(() => "ok" as const, (error: Error) => error.message).finally(() => { settled = true; });
      await new Promise((resolve) => setTimeout(resolve, 500));
      assert.equal(settled, false, "applyPlan must wait on the project row lock");
      releaseA();
      await a;
      assert.equal(await b, "CONFLICT_STATE");
      assert.equal(await base.epic.count({ where: { projectId } }), 0);
    });
  });

  it("E55 applyPlan committed first leaves its rows and the archive follows", async () => {
    await withIntegrationDb(async (base, f) => {
      const db = createDbClient(base);
      const pm = await f.user("PM");
      const projectId = await f.project(pm);
      await f.member(projectId, pm);
      await db.$transaction((tx) => applyPlan(tx, projectId, plan(), pm));
      await base.project.update({ where: { id: projectId }, data: { status: "ARCHIVED" } });
      assert.equal(await base.epic.count({ where: { projectId } }), 2);
    });
  });
});
