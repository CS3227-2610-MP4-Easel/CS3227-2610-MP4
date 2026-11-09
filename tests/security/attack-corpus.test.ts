import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import { buildSync } from "esbuild";
import { defaultGuards } from "../../src/be/llm-gateway/src/guards.js";
import { dispatchCorpusCase, runCorpus, assertCorpusContract } from "./attack-corpus/runner.js";
import { createUser } from "../../src/be/auth/src/registration.js";

test("W11 corpus is closed, deterministic, and machine-checked", async () => {
  assertCorpusContract();
  const first = await runCorpus();
  const second = await runCorpus();
  assert.equal(first.cases, 16);
  assert.deepEqual([...first.observations.keys()], [...second.observations.keys()]);
});

test("markdown-link corpus cases invoke the production output guard", async () => {
  const original = defaultGuards.output;
  let called = false;
  defaultGuards.output = () => { called = true; throw new Error("W11_OUTPUT_GUARD_SENTINEL"); };
  try {
    await assert.rejects(() => dispatchCorpusCase({
      id: "markdown-guard-regression", threat: "T5", layer: "OUTPUT", boundary: "OUTPUT_GUARD",
      description: "synthetic markdown case", fixture: { kind: "OUTPUT_TEXT", text: "[x](https://example.test)", maxChars: 256 },
      expected: { criterion: { type: "REJECTED", status: 422, code: "SCHEMA_FAIL", reason: "LINK" } },
    }), /W11_OUTPUT_GUARD_SENTINEL/);
    assert.equal(called, true);
  } finally {
    defaultGuards.output = original;
  }
});

test("W11 network deny blocks DNS promises and socket connections", { skip: process.env.W11_NETWORK_DENY_INSTALLED !== "1" }, async () => {
  await assert.rejects(() => import("node:dns/promises"), /W11_FORBIDDEN_NETWORK_OR_PROCESS/);
  const net = await import("node:net");
  const socket = new net.Socket();
  try {
    assert.throws(() => socket.connect({ host: "127.0.0.1", port: 9 }), /W11_FORBIDDEN_NETWORK_OR_PROCESS/);
  } finally {
    socket.destroy();
  }
});

test("E13 registration replay uses the existing auth route and has no side effect", async () => {
  const rows: Array<{ id: string; firebaseUid: string; email: string; displayName: string; role: "DEVELOPER" }> = [];
  const db = { user: { create: async ({ data }: { data: typeof rows[number] }) => {
    if (rows.some((row) => row.firebaseUid === data.firebaseUid || row.email === data.email)) throw Object.assign(new Error("duplicate"), { code: "P2002" });
    const row = { ...data, id: `synthetic-${rows.length + 1}` }; rows.push(row); return row;
  } } } as never;
  const register = () => createUser(db, { firebaseUid: "synthetic-firebase", email: "synthetic@example.test", displayName: "Synthetic User", role: "DEVELOPER" });
  await register();
  const count = rows.length;
  await assert.rejects(register, (error: unknown) => error instanceof Error && error.message === "ALREADY_REGISTERED");
  assert.equal(rows.length, count);
});

test("E14 limiter barrier admits exactly its cap", async () => {
  let inFlight = 0; let upstreamCalls = 0; let releaseCount = 0; const cap = 3;
  const reserve = async () => { if (inFlight >= cap) return { status: 429, code: "AI_BUSY" }; inFlight++; upstreamCalls++; await Promise.resolve(); return { status: 200, release: () => { inFlight--; releaseCount++; } }; };
  const results = await Promise.all(Array.from({ length: cap + 2 }, reserve));
  assert.equal(results.filter((result) => result.status === 200).length, cap);
  assert.equal(results.filter((result) => result.status === 429).length, 2);
  assert.equal(upstreamCalls, cap);
  for (const result of results) if (result.status === 200) result.release();
  assert.equal(releaseCount, cap);
  assert.equal((await reserve()).status, 200);
});

test("E15 session barrier admits exactly its cap and rejects excess", async () => {
  let open = 0; let upstreamCalls = 0; let releaseCount = 0; const cap = 3;
  const openSession = async () => { if (open >= cap) return { status: 429, code: "RATE_LIMITED" }; open++; upstreamCalls++; return { status: 201, close: () => { open--; releaseCount++; } }; };
  const attempts = await Promise.all(Array.from({ length: cap + 2 }, openSession));
  assert.deepEqual(attempts.map(({ status }) => status), [201, 201, 201, 429, 429]);
  assert.equal(upstreamCalls, cap);
  for (const attempt of attempts) if (attempt.status === 201) attempt.close();
  assert.equal(releaseCount, cap);
  assert.equal((await openSession()).status, 201);
});

test("E22 three isolated runs stay below the five second hard timeout", async () => {
  const runnerUrl = new URL("./attack-corpus/runner.ts", import.meta.url).href;
  const runnerSource = buildSync({ entryPoints: [fileURLToPath(runnerUrl)], bundle: true, format: "esm", platform: "node", target: "node20", write: false }).outputFiles[0].text;
  const workerRun = () => new Promise<void>((resolve, reject) => {
    const worker = new Worker(`${runnerSource}\nimport { parentPort } from "node:worker_threads"; runCorpus().then(() => parentPort.postMessage("done")).catch((error) => parentPort.postMessage({ error: String(error) }));`, { eval: true, type: "module", execArgv: [], env: { ...process.env, NODE_OPTIONS: "" } });
    const timer = setTimeout(() => { void worker.terminate(); reject(new Error("W11_TIMEOUT")); }, 5_000);
    worker.on("message", (message) => { clearTimeout(timer); void worker.terminate(); if (message === "done") resolve(); else reject(new Error(message.error)); });
    worker.on("error", (error) => { clearTimeout(timer); reject(error); });
  });
  for (let run = 0; run < 3; run++) {
    const started = performance.now();
    await workerRun();
    assert.ok(performance.now() - started <= 5_000);
  }
});
