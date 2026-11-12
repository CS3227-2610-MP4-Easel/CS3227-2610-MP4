import assert from "node:assert/strict";
import { test } from "node:test";
import { createDbClient, type FilteredDbClient } from "@agile/db";
import { createSimilarItemsSource } from "../src/similar-items.js";
import { integrationUrl, withIntegrationDb } from "./fakes.js";

type Item = { id: string; projectId: string; title: string };
type Where = { projectId: { in: string[] }; OR: Array<{ title: { contains: string; mode: string } }> };

/** In-memory stand-in honouring `in`, `contains` (insensitive), `orderBy: id asc` and `take`. */
function fakeDb(members: Array<{ userId: string; projectId: string }>, epics: Item[], tasks: Item[]) {
  const reads: Array<{ model: string; take: number }> = [];
  const finder = (model: string, rows: Item[]) => ({
    findMany: async (args: { where: Where; orderBy: { id: string }; take: number; select: Record<string, boolean> }) => {
      reads.push({ model, take: args.take });
      assert.deepEqual(args.orderBy, { id: "asc" });
      return rows
        .filter((row) => args.where.projectId.in.includes(row.projectId))
        .filter((row) => args.where.OR.some((c) => row.title.toLowerCase().includes(c.title.contains.toLowerCase())))
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
        .slice(0, args.take)
        .map(({ id, projectId, title }) => ({ id, projectId, title }));
    },
  });
  const db = {
    projectMember: { findMany: async ({ where }: { where: { userId: string } }) => members.filter((m) => m.userId === where.userId).map((m) => ({ projectId: m.projectId })) },
    epic: finder("epic", epics),
    task: finder("task", tasks),
  };
  return { db: db as unknown as FilteredDbClient, reads };
}

const caller = { userId: "u1", role: "PM" as const };
const args = (query: string | undefined) => ({ caller, projectId: "p1", options: query === undefined ? {} : { query } });
const on = { similarItems: true };

test("E14 flag off returns nothing", async () => {
  const { db, reads } = fakeDb([{ userId: "u1", projectId: "p1" }], [{ id: "e1", projectId: "p1", title: "Payments" }], []);
  assert.deepEqual(await createSimilarItemsSource({ db, settings: { similarItems: false } })(args("payments")), []);
  assert.equal(reads.length, 0);
});

test("E14 no keyword of 4 characters, no query, or no match return nothing", async () => {
  const { db } = fakeDb([{ userId: "u1", projectId: "p1" }], [{ id: "e1", projectId: "p1", title: "Payments" }], []);
  const source = createSimilarItemsSource({ db, settings: on });
  assert.deepEqual(await source(args("a bc def !!! ???")), []);
  assert.deepEqual(await source(args(undefined)), []);
  assert.deepEqual(await source(args("zzzzzz")), []);
  const none = fakeDb([], [{ id: "e1", projectId: "p1", title: "Payments" }], []);
  assert.deepEqual(await createSimilarItemsSource({ db: none.db, settings: on })(args("payments")), []);
});

test("E14 a Persian word of 5 letters is a keyword", async () => {
  const word = "سلامت"; // five Persian letters
  assert.equal([...word].length, 5);
  const { db } = fakeDb([{ userId: "u1", projectId: "p1" }], [{ id: "e1", projectId: "p1", title: `x ${word} y` }, { id: "e2", projectId: "p1", title: "other" }], []);
  const rows = await createSimilarItemsSource({ db, settings: on })(args(word));
  assert.deepEqual(rows.map((r) => r.ref.id), ["e1"]);
});

test("E15 120 matches read at most 100 candidates, return 5 ranked deterministically", async () => {
  const pad = (n: number) => String(n).padStart(3, "0");
  const epics: Item[] = [];
  const tasks: Item[] = [];
  for (let i = 1; i <= 120; i += 1) {
    epics.push({ id: `e${pad(i)}`, projectId: "p1", title: `alpha epic ${pad(i)}` });
    tasks.push({ id: `t${pad(i)}`, projectId: "p1", title: `alpha task ${pad(i)}` });
  }
  // Inside the first 50 ids: two items carry both keywords. Beyond 50: one carries both but is never read.
  tasks[30] = { id: "t031", projectId: "p1", title: "Beta alpha task" };
  epics[40] = { id: "e041", projectId: "p1", title: "alpha BETA epic" };
  tasks[100] = { id: "t101", projectId: "p1", title: "alpha beta late" };
  const { db, reads } = fakeDb([{ userId: "u1", projectId: "p1" }], epics, tasks);
  const source = createSimilarItemsSource({ db, settings: on });
  const first = await source(args("alpha beta"));
  assert.deepEqual(reads.map((r) => r.take), [50, 50]);
  assert.equal(first.length, 5);
  // two keywords first (EPIC before TASK), then one keyword: EPIC before TASK, title by code point, then id.
  assert.deepEqual(first.map((r) => r.ref.id), ["e041", "t031", "e001", "e002", "e003"]);
  assert.ok(!first.some((r) => r.ref.id === "t101"));
  assert.deepEqual(first.map((r) => r.ref.type), ["EPIC", "TASK", "EPIC", "EPIC", "EPIC"]);
  assert.ok(first.every((r) => r.ownerId === undefined && r.projectId === "p1"));
  assert.deepEqual(await source(args("alpha beta")), first);
});

test("E15 12 matches return exactly 5, ties broken by EPIC, title, id", async () => {
  const epics: Item[] = [];
  const tasks: Item[] = [];
  for (let i = 0; i < 6; i += 1) {
    epics.push({ id: `e${i}`, projectId: "p1", title: `gamma ${String.fromCharCode(70 - i)}` });
    tasks.push({ id: `t${i}`, projectId: "p1", title: `gamma ${String.fromCharCode(70 - i)}` });
  }
  const { db } = fakeDb([{ userId: "u1", projectId: "p1" }], epics, tasks);
  const rows = await createSimilarItemsSource({ db, settings: on })(args("GAMMA"));
  assert.equal(rows.length, 5);
  assert.deepEqual(rows.map((r) => r.ref.id), ["e5", "e4", "e3", "e2", "e1"]);
});

test("E16 a match in the last 50 characters of a 400 character title ranks by the full title, text cut to 200", async () => {
  const title = `${"x".repeat(350)} zebra crossing ${"y".repeat(34)}`.slice(0, 400);
  assert.equal(title.length, 400);
  const { db } = fakeDb([{ userId: "u1", projectId: "p1" }], [{ id: "e1", projectId: "p1", title }, { id: "e2", projectId: "p1", title: "zebra" }], []);
  const rows = await createSimilarItemsSource({ db, settings: on })(args("zebra crossing"));
  assert.deepEqual(rows.map((r) => r.ref.id), ["e1", "e2"]);
  assert.equal(rows[0]?.text.length, 200);
  assert.equal(rows[0]?.text, title.slice(0, 200));
});

test("keywords are limited to the first 8 distinct words", async () => {
  const { db } = fakeDb([{ userId: "u1", projectId: "p1" }], [{ id: "e1", projectId: "p1", title: "ninth" }], []);
  const rows = await createSimilarItemsSource({ db, settings: on })(args("one1 two2 three four five5 six6 seven eight one1 ninth"));
  assert.deepEqual(rows, []);
});

test("E12 only member project rows are returned", { skip: !integrationUrl }, async () => {
  await withIntegrationDb(async (base, f) => {
    const me = await f.user();
    const other = await f.user();
    const a = await f.project(me);
    const b = await f.project(other);
    await f.member(a, me);
    await f.member(b, other);
    const epicA = await f.epic(a, "Billing overhaul");
    const epicB = await f.epic(b, "Billing secret");
    const taskA = await f.task(a, epicA, me, "billing report");
    await f.task(b, epicB, other, "billing hidden");
    const source = createSimilarItemsSource({ db: createDbClient(base), settings: on });
    const rows = await source({ caller: { userId: me, role: "PM" }, projectId: a, options: { query: "BILLING" } });
    assert.deepEqual(rows.map((r) => r.ref.id).sort(), [epicA, taskA].sort());
    assert.ok(rows.every((r) => r.projectId === a && r.ownerId === undefined));
    const none = await source({ caller: { userId: other, role: "PM" }, projectId: b, options: { query: "overhaul" } });
    assert.deepEqual(none, []);
  });
});

test("E13 soft-deleted, archived project and removed membership are not returned", { skip: !integrationUrl }, async () => {
  await withIntegrationDb(async (base, f) => {
    const me = await f.user();
    const live = await f.project(me);
    const archived = await f.project(me);
    const removed = await f.project(me);
    await f.member(live, me);
    await f.member(archived, me);
    await f.member(removed, me);
    const liveEpic = await f.epic(live, "Quartz live");
    const deletedEpic = await f.epic(live, "Quartz deleted epic");
    const deletedTask = await f.task(live, liveEpic, me, "Quartz deleted task");
    await f.epic(archived, "Quartz archived");
    await f.epic(removed, "Quartz removed");
    await base.epic.update({ where: { id: deletedEpic }, data: { deletedAt: new Date() } });
    await base.task.update({ where: { id: deletedTask }, data: { deletedAt: new Date() } });
    await f.archive(archived);
    await base.projectMember.delete({ where: { projectId_userId: { projectId: removed, userId: me } } });
    const source = createSimilarItemsSource({ db: createDbClient(base), settings: on });
    const rows = await source({ caller: { userId: me, role: "PM" }, projectId: live, options: { query: "quartz" } });
    assert.deepEqual(rows.map((r) => r.ref.id), [liveEpic]);
  });
});
