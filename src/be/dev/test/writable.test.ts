import assert from "node:assert/strict";
import test from "node:test";
import { NotMember } from "@agile/contracts";
import { inDevWrite } from "../src/index.js";

type Opts = { status?: string | null; lockCodes?: string[]; member?: boolean; memberError?: Error };

function harness(opts: Opts = {}) {
  const log = { commits: 0, rollbacks: 0, attempts: 0, mutated: 0, members: 0, locks: [] as unknown[], finds: [] as unknown[] };
  const codes = [...(opts.lockCodes ?? [])];
  const tx = {
    project: {
      update: async (args: unknown) => { log.locks.push(args); const code = codes.shift(); if (code) throw Object.assign(new Error("x"), { code }); return {}; },
      findFirst: async (args: unknown) => { log.finds.push(args); return opts.status === null ? null : { status: opts.status ?? "ACTIVE" }; },
    },
  };
  const db = { $transaction: async <R,>(fn: (t: unknown) => Promise<R>) => { log.attempts++; try { const r = await fn(tx); log.commits++; return r; } catch (e) { log.rollbacks++; throw e; } } };
  const requireMember = async () => {
    log.members++;
    if (opts.memberError) throw opts.memberError;
    if (opts.member === false) throw new NotMember("u", "p");
  };
  const mutate = async () => { log.mutated++; return "ok"; };
  return { log, mutate, deps: { db, requireMember } };
}

test("E40 archived project rejects CONFLICT_STATE before membership and skips mutate", async () => {
  const h = harness({ status: "ARCHIVED", member: false });
  await assert.rejects(inDevWrite(h.deps, "u", "p", h.mutate), { message: "CONFLICT_STATE" });
  assert.equal(h.log.mutated, 0);
  assert.equal(h.log.members, 0);
  assert.equal(h.log.rollbacks, 1);
  assert.equal(h.log.commits, 0);
});

test("E40 missing project row rejects CONFLICT_STATE", async () => {
  const h = harness({ status: null });
  await assert.rejects(inDevWrite(h.deps, "u", "p", h.mutate), { message: "CONFLICT_STATE" });
  assert.equal(h.log.mutated, 0);
});

test("E40 non-ACTIVE, non-ARCHIVED status rejects CONFLICT_STATE", async () => {
  const h = harness({ status: "DELETED" });
  await assert.rejects(inDevWrite(h.deps, "u", "p", h.mutate), { message: "CONFLICT_STATE" });
  assert.equal(h.log.mutated, 0);
});

test("E62/E63 removed member rejects NOT_FOUND and skips mutate", async () => {
  const h = harness({ member: false });
  await assert.rejects(inDevWrite(h.deps, "u", "p", h.mutate), { message: "NOT_FOUND" });
  assert.equal(h.log.mutated, 0);
  assert.equal(h.log.rollbacks, 1);
  assert.equal(h.log.commits, 0);
});

test("E62/E63 requireMember throwing Error NOT_FOUND rejects NOT_FOUND", async () => {
  const h = harness({ memberError: new Error("NOT_FOUND") });
  await assert.rejects(inDevWrite(h.deps, "u", "p", h.mutate), { message: "NOT_FOUND" });
  assert.equal(h.log.mutated, 0);
});

test("E62/E63 other requireMember errors are rethrown unchanged", async () => {
  const sentinel = new Error("db down");
  const h = harness({ memberError: sentinel });
  await assert.rejects(inDevWrite(h.deps, "u", "p", h.mutate), (e) => e === sentinel);
  assert.equal(h.log.mutated, 0);
  assert.equal(h.log.rollbacks, 1);
});

test("E40 lock P2025 maps to CONFLICT_STATE without retry", async () => {
  const h = harness({ lockCodes: ["P2025"] });
  await assert.rejects(inDevWrite(h.deps, "u", "p", h.mutate), { message: "CONFLICT_STATE" });
  assert.equal(h.log.mutated, 0);
  assert.equal(h.log.attempts, 1);
  assert.equal(h.log.rollbacks, 1);
});

test("E40 serialization failure 40001 is retried", async () => {
  const h = harness({ lockCodes: ["40001"] });
  assert.equal(await inDevWrite(h.deps, "u", "p", h.mutate), "ok");
  assert.equal(h.log.attempts, 2);
  assert.equal(h.log.rollbacks, 1);
  assert.equal(h.log.commits, 1);
  assert.equal(h.log.mutated, 1);
});

test("E40 mutate failure propagates unchanged and rolls back once", async () => {
  const sentinel = new Error("boom");
  const h = harness();
  await assert.rejects(inDevWrite(h.deps, "u", "p", async () => { throw sentinel; }), (e) => e === sentinel);
  assert.equal(h.log.attempts, 1);
  assert.equal(h.log.rollbacks, 1);
  assert.equal(h.log.commits, 0);
});

test("E40 the lock targets the project row and the check reads the same id", async () => {
  const h = harness();
  await inDevWrite(h.deps, "u", "p", h.mutate);
  assert.equal(h.log.locks.length, 1);
  assert.equal((h.log.locks[0] as { where: { id: string } }).where.id, "p");
  assert.deepEqual((h.log.finds[0] as { where: unknown }).where, { id: "p" });
});
