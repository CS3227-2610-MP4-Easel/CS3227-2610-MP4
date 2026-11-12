import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import type { PrismaClient } from "@prisma/client";
import { createSessions } from "../src/index.js";
import { fakeClock } from "./fakes.js";

const MIN = 60_000;
const START = "2026-11-05T02:00:00.000Z";
type Row = { id: string; env: string; userId: string; feature: string; outcome: string; lastActivityAt: Date };

function fakeDb(rows: Row[], failFind?: Error) {
  const log = { findMany: [] as Array<Record<string, unknown>>, created: 0, abandoned: [] as string[] };
  const db = {
    aiSession: {
      findMany: async (args: Record<string, unknown>) => {
        log.findMany.push(args);
        const where = args.where as Record<string, unknown>;
        if (where.outcome === "OPEN" && "projectId" in where) return rows.filter((r) => r.outcome === "OPEN").sort((a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime()).map((r) => ({ id: r.id }));
        return [];
      },
      findUnique: async ({ where }: { where: { id: string } }) => { if (failFind) throw failFind; return rows.find((r) => r.id === where.id) ?? null; },
      updateMany: async ({ where }: { where: { id?: string } }) => { if (where.id) log.abandoned.push(where.id); return { count: 1 }; },
      count: async () => 0,
      create: async () => { log.created += 1; return { id: randomUUID() }; },
    },
  } as unknown as PrismaClient;
  return { db, log };
}
const row = (userId: string, minutesIdle: number): Row => ({ id: randomUUID(), env: "test", userId, feature: "DEV_SUMMARY", outcome: "OPEN", lastActivityAt: new Date(new Date(START).getTime() - minutesIdle * MIN) });

test("E75 openOrReuse queries this key newest first and returns the first usable session without creating", async () => {
  const userId = randomUUID();
  const projectId = randomUUID();
  const rows = [row(userId, 20), row(userId, 5)];
  const { db, log } = fakeDb(rows);
  const sessions = createSessions({ db, settings: { tier: "test" }, clock: fakeClock(START) });
  assert.equal(await sessions.openOrReuse({ feature: "DEV_SUMMARY", userId, projectId }), rows[1].id);
  assert.deepEqual(log.findMany[0].where, { userId, env: "test", feature: "DEV_SUMMARY", projectId, outcome: "OPEN" });
  assert.deepEqual(log.findMany[0].orderBy, { lastActivityAt: "desc" });
  assert.equal(log.created, 0);
});

test("E75 openOrReuse abandons an idle newest candidate and returns the next usable one", async () => {
  const userId = randomUUID();
  const idle = row(userId, 31);
  const usable = row(userId, 20);
  const { db, log } = fakeDb([idle, usable]);
  // The query is mocked to return the idle one first, as if it were the newest when queried.
  (db.aiSession as unknown as { findMany: unknown }).findMany = async () => [{ id: idle.id }, { id: usable.id }];
  const sessions = createSessions({ db, settings: { tier: "test" }, clock: fakeClock(START) });
  assert.equal(await sessions.openOrReuse({ feature: "DEV_SUMMARY", userId, projectId: null }), usable.id);
  assert.deepEqual(log.abandoned, [idle.id]);
  assert.equal(log.created, 0);
});

test("E75 openOrReuse opens a session when none is usable, and a database error propagates without opening", async () => {
  const userId = randomUUID();
  const { db, log } = fakeDb([]);
  const sessions = createSessions({ db, settings: { tier: "test" }, clock: fakeClock(START) });
  await sessions.openOrReuse({ feature: "DEV_SUMMARY", userId, projectId: null });
  assert.equal(log.created, 1);

  const broken = fakeDb([row(userId, 1)], new Error("connection lost"));
  const failing = createSessions({ db: broken.db, settings: { tier: "test" }, clock: fakeClock(START) });
  await assert.rejects(failing.openOrReuse({ feature: "DEV_SUMMARY", userId, projectId: null }), { message: "connection lost" });
  assert.equal(broken.log.created, 0);
});

test("E75 a detached openOrReuse still works", async () => {
  const userId = randomUUID();
  const { db, log } = fakeDb([]);
  const { openOrReuse } = createSessions({ db, settings: { tier: "test" }, clock: fakeClock(START) });
  assert.ok(await openOrReuse({ feature: "DEV_SUMMARY", userId, projectId: null }));
  assert.equal(log.created, 1);
});
