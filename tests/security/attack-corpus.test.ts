import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import { buildSync } from "esbuild";
import { SESSION_CAPS } from "@agile/contracts";
import { defaultGuards } from "../../src/be/llm-gateway/src/guards.js";
import { createLlmGateway } from "../../src/be/llm-gateway/src/gateway.js";
import { LIMITS } from "../../src/be/llm-gateway/src/config.js";
import { createSessions, SessionCapReached } from "../../src/be/llm-gateway/src/sessions.js";
import { loadGatewaySettings } from "../../src/be/llm-gateway/src/settings.js";
import { dispatchCorpusCase, runCorpus, assertCorpusContract } from "./attack-corpus/runner.js";
import { createHit } from "../../src/be/auth/src/rate-limit.js";
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

test("E14 gateway limiter barrier maps excess to AI_BUSY", async () => {
  const userId = "00000000-0000-4000-8000-000000000001";
  const sessionId = "00000000-0000-4000-8000-000000000002";
  const projectId = "00000000-0000-4000-8000-000000000003";
  const calls: Array<{ id: string; status: string }> = [];
  const state = new Map<string, unknown>();
  const db = {
    aiSession: { findUnique: async () => ({ projectId }) },
    llmGatewayState: {
      findUnique: async ({ where }: { where: { key: string } }) => state.has(where.key) ? { value: state.get(where.key) } : null,
      upsert: async ({ where, update }: { where: { key: string }; update: { value: unknown } }) => { state.set(where.key, update.value); return {}; },
    },
    llmCall: {
      aggregate: async () => ({ _sum: { costMicrousd: 0n } }),
      create: async () => { const row = { id: `call-${calls.length + 1}`, status: "IN_FLIGHT" }; calls.push(row); return { id: row.id }; },
      updateMany: async ({ where, data }: { where: { id?: string }; data: { status?: string } }) => {
        const row = where.id === undefined ? undefined : calls.find((candidate) => candidate.id === where.id);
        if (row && data.status) row.status = data.status;
        return { count: row ? 1 : 0 };
      },
    },
  } as never;
  const counts = new Map<string, number>();
  const hit = createHit(async (key) => {
    const count = (counts.get(key) ?? 0) + 1;
    counts.set(key, count);
    return { count, remainingSeconds: 60 };
  });
  const gateway = createLlmGateway({
    settings: loadGatewaySettings({ APP_TIER: "test", LLM_MODE: "mock" }),
    db,
    hit,
    sessions: { assertUsable: async () => {}, touch: async () => {} },
    provider: { complete: async () => ({ text: "safe", promptTokens: 1, completionTokens: 1 }) },
    mockResponses: new Map([["DEV_STANDUP", () => "safe"]]),
    boundary: () => "0123456789abcdef",
  });
  const call = {
    feature: "DEV_STANDUP",
    caller: { userId, role: "DEVELOPER" },
    sessionId,
    projectId,
    sections: [
      { name: "rules", kind: "STATIC", priority: 0, budgetTokens: 200, text: "Write a standup.", trusted: true },
      { name: "items", kind: "DYNAMIC", priority: 1, budgetTokens: 400, text: "Fixed the login bug.", trusted: false },
    ],
    output: { kind: "text", maxChars: 500 },
    inputHash: "synthetic-hash",
  } as const;
  const results = await Promise.all(Array.from({ length: LIMITS.windows.userMin.limit + 1 }, () => gateway.run(call)));
  assert.equal(results.filter((result) => result.ok).length, LIMITS.windows.userMin.limit);
  assert.deepEqual(results.at(-1), { ok: false, code: "AI_BUSY", retryAfterSeconds: 60 });
});

test("E15 session barrier admits exactly its cap and rejects excess", async () => {
  const cap = SESSION_CAPS.maxRegenerations;
  const userId = "00000000-0000-4000-8000-000000000001";
  const sessionId = "00000000-0000-4000-8000-000000000002";
  let regenerateCount = 0;
  let updateAttempts = 0;
  const db = {
    aiSession: {
      findUnique: async () => ({ userId, feature: "DEV_STANDUP", env: "test", outcome: "OPEN", lastActivityAt: new Date() }),
      updateMany: async ({ where }: { where: { regenerateCount?: { lt?: number } } }) => {
        updateAttempts++;
        if (regenerateCount >= (where.regenerateCount?.lt ?? Number.POSITIVE_INFINITY)) return { count: 0 };
        regenerateCount++;
        return { count: 1 };
      },
    },
  } as never;
  const sessions = createSessions({ db, settings: { tier: "test" } });
  const attempts = await Promise.allSettled(Array.from({ length: cap + 2 }, () => sessions.regenerate(sessionId, userId)));
  assert.equal(attempts.filter((attempt) => attempt.status === "fulfilled").length, cap);
  assert.equal(attempts.filter((attempt) => attempt.status === "rejected" && attempt.reason instanceof SessionCapReached).length, 2);
  assert.equal(regenerateCount, cap);
  assert.equal(updateAttempts, cap + 2);
});

test("E22 three isolated runs stay below the five second hard timeout", async () => {
  const runnerUrl = new URL("./attack-corpus/runner.ts", import.meta.url).href;
  const runnerSource = buildSync({ entryPoints: [fileURLToPath(runnerUrl)], bundle: true, format: "esm", platform: "node", target: "node20", write: false }).outputFiles[0].text;
  const denySetupUrl = new URL("./w11-network-deny.setup.ts", import.meta.url);
  const denySetupSource = buildSync({ entryPoints: [fileURLToPath(denySetupUrl)], bundle: true, format: "esm", platform: "node", target: "node20", define: { "import.meta.url": JSON.stringify(denySetupUrl.href) }, write: false }).outputFiles[0].text;
  const denySetupModule = `data:text/javascript,${encodeURIComponent(denySetupSource)}`;
  const runnerModule = `data:text/javascript,${encodeURIComponent(runnerSource)}`;
  const workerRun = () => new Promise<void>((resolve, reject) => {
    const worker = new Worker(`import { parentPort } from "node:worker_threads"; await import(${JSON.stringify(denySetupModule)}); const { runCorpus } = await import(${JSON.stringify(runnerModule)}); runCorpus().then(() => parentPort.postMessage("done")).catch((error) => parentPort.postMessage({ error: String(error) }));`, { eval: true, type: "module", execArgv: [], env: { ...process.env, NODE_OPTIONS: "" } });
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

test("E22 isolated workers install the network deny setup", async () => {
  const setupUrl = new URL("./w11-network-deny.setup.ts", import.meta.url);
  const setupSource = buildSync({ entryPoints: [fileURLToPath(setupUrl)], bundle: true, format: "esm", platform: "node", target: "node20", define: { "import.meta.url": JSON.stringify(setupUrl.href) }, write: false }).outputFiles[0].text;
  const setupModule = `data:text/javascript,${encodeURIComponent(setupSource)}`;
  const result = await new Promise<string>((resolve, reject) => {
    const worker = new Worker(`import { parentPort } from 'node:worker_threads'; await import(${JSON.stringify(setupModule)}); import('node:dns/promises').then(() => parentPort.postMessage('imported')).catch((error) => parentPort.postMessage(String(error)))`, { eval: true, type: "module", execArgv: [], env: { ...process.env, NODE_OPTIONS: "" } });
    worker.on("message", (message) => { void worker.terminate(); resolve(String(message)); });
    worker.on("error", reject);
  });
  assert.match(result, /W11_FORBIDDEN_NETWORK_OR_PROCESS/);
});

test("E22 isolated workers block bare child_process and filesystem promise writes", async () => {
  const setupUrl = new URL("./w11-network-deny.setup.ts", import.meta.url);
  const setupSource = buildSync({ entryPoints: [fileURLToPath(setupUrl)], bundle: true, format: "esm", platform: "node", target: "node20", define: { "import.meta.url": JSON.stringify(setupUrl.href) }, write: false }).outputFiles[0].text;
  const setupModule = `data:text/javascript,${encodeURIComponent(setupSource)}`;
  const result = await new Promise<string>((resolve, reject) => {
    const worker = new Worker(`import { parentPort } from 'node:worker_threads'; import ${JSON.stringify(setupModule)}; const results = []; try { const childProcess = await import('child_process'); childProcess.spawnSync('true'); results.push('child-process-allowed'); } catch (error) { results.push(String(error)); } try { const fs = await import('node:fs/promises'); await fs.writeFile('/outside-w11-fixture.txt', 'blocked'); results.push('filesystem-allowed'); } catch (error) { results.push(String(error)); } parentPort.postMessage(results.join('\\n'));`, { eval: true, type: "module", execArgv: [], env: { ...process.env, NODE_OPTIONS: "" } });
    worker.on("message", (message) => { void worker.terminate(); resolve(String(message)); });
    worker.on("error", reject);
  });
  assert.match(result, /W11_FORBIDDEN_NETWORK_OR_PROCESS/);
  assert.match(result, /W11_FORBIDDEN_FILESYSTEM/);
  assert.doesNotMatch(result, /allowed/);
});
