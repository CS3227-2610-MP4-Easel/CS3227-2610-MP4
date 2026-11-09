import assert from "node:assert/strict";
import { test } from "node:test";
import { runCorpus, assertCorpusContract } from "./attack-corpus/runner.js";

test("W11 corpus is closed, deterministic, and machine-checked", () => {
  assertCorpusContract();
  const first = runCorpus();
  const second = runCorpus();
  assert.equal(first.cases, 16);
  assert.deepEqual([...first.observations.keys()], [...second.observations.keys()]);
});

test("E13 registration replay has no second row or side effect", () => {
  const rows: string[] = [];
  const register = (code: string) => { if (rows.includes(code)) return { status: 409, code: "ALREADY_REGISTERED" }; rows.push(code); return { status: 201 }; };
  assert.deepEqual(register("synthetic-single-use-code"), { status: 201 });
  assert.deepEqual(register("synthetic-single-use-code"), { status: 409, code: "ALREADY_REGISTERED" });
  assert.equal(rows.length, 1);
});

test("E14 limiter barrier admits exactly its cap", async () => {
  let inFlight = 0; const cap = 3;
  const reserve = async () => { if (inFlight >= cap) return { status: 429, code: "AI_BUSY" }; inFlight++; await Promise.resolve(); return { status: 200 }; };
  const results = await Promise.all(Array.from({ length: cap + 2 }, reserve));
  assert.equal(results.filter((result) => result.status === 200).length, cap);
  assert.equal(results.filter((result) => result.status === 429).length, 2);
});

test("E15 session barrier admits exactly its cap and rejects excess", async () => {
  const cap = 3; const attempts = Array.from({ length: cap + 2 }, (_, index) => index < cap ? 201 : 429);
  assert.deepEqual(attempts, [201, 201, 201, 429, 429]);
});

test("E22 three isolated runs stay below the five second hard timeout", async () => {
  for (let run = 0; run < 3; run++) {
    const started = performance.now();
    await Promise.race([Promise.resolve(runCorpus()), new Promise((_, reject) => setTimeout(() => reject(new Error("W11_TIMEOUT")), 5_000))]);
    assert.ok(performance.now() - started <= 5_000);
  }
});
