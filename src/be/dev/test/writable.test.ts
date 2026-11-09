import assert from "node:assert/strict";
import test from "node:test";
import { NotMember } from "@agile/contracts";
import { inDevWrite } from "../src/index.js";

function harness(opts: { status?: string | null; lockCodes?: string[]; member?: boolean } = {}) {
  const log = { commits: 0, rollbacks: 0, attempts: 0, mutated: 0 };
  const codes = [...(opts.lockCodes ?? [])];
  const tx = {
    project: {
      update: async () => { const code = codes.shift(); if (code) throw Object.assign(new Error("x"), { code }); return {}; },
      findFirst: async () => (opts.status === null ? null : { status: opts.status ?? "ACTIVE" }),
    },
  };
  const db = { $transaction: async <R,>(fn: (t: unknown) => Promise<R>) => { log.attempts++; try { const r = await fn(tx); log.commits++; return r; } catch (e) { log.rollbacks++; throw e; } } };
  const requireMember = async () => { if (opts.member === false) throw new NotMember("u", "p"); };
  return { log, deps: { db, requireMember } };
}

test("E40 archived project rejects CONFLICT_STATE and skips mutate", async () => {
  const h = harness({ status: "ARCHIVED", member: false });
  await assert.rejects(inDevWrite(h.deps, "u", "p", async () => { h.log.mutated++; }), /CONFLICT_STATE/);
  assert.equal(h.log.mutated, 0);
});

test("E62/E63 removed member rejects NOT_FOUND and skips mutate", async () => {
  const h = harness({ member: false });
  await assert.rejects(inDevWrite(h.deps, "u", "p", async () => { h.log.mutated++; }), /NOT_FOUND/);
  assert.equal(h.log.mutated, 0);
});

test("E40 lock P2025 maps to CONFLICT_STATE", async () => {
  const h = harness({ lockCodes: ["P2025"] });
  await assert.rejects(inDevWrite(h.deps, "u", "p", async () => 1), /CONFLICT_STATE/);
});

test("E40 serialization failure 40001 is retried", async () => {
  const h = harness({ lockCodes: ["40001"] });
  assert.equal(await inDevWrite(h.deps, "u", "p", async () => "ok"), "ok");
  assert.equal(h.log.attempts, 2);
});

test("E40 mutate failure propagates and rolls back", async () => {
  const h = harness();
  await assert.rejects(inDevWrite(h.deps, "u", "p", async () => { throw new Error("boom"); }), /boom/);
  assert.equal(h.log.rollbacks, 1);
  assert.equal(h.log.commits, 0);
});
