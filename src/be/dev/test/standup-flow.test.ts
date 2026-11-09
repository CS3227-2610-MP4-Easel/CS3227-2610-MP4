import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import { NotMember, type ContextSections, type LlmResult } from "@agile/contracts";
import { checkOutput } from "@agile/llm-gateway";
import { generateStandup, type StandupFlowDeps } from "../src/flows/standups.js";
import { sectionsInputHash, standupInputHash } from "../src/ai/hash.js";
import { STANDUP_PROMPT_VERSION, STANDUP_STATIC, withStatics } from "../src/ai/prompts.js";
import { DevError } from "../src/errors.js";

const P = "p";
const U = "d1";
const DATE = "2026-11-09";
const NOW = new Date("2026-11-09T02:00:00Z");
const sec = (name: string, text: string): ContextSections[number] => ({ name, kind: "RETRIEVED", priority: 1, budgetTokens: 500, trusted: false, text });
const checkLine = (line: string) => checkOutput(line, { kind: "text", maxChars: 300 }, { boundary: randomBytes(8).toString("hex"), secrets: [] }).ok;
const okResult = (value: unknown, flagged = false): LlmResult => ({ ok: true, value, callId: "c", flagged, truncated: false, cacheHit: false, promptTokens: 1, completionTokens: 1, costMicroUsd: 1 });
const named = (name: string, extra: object = {}) => Object.assign(new Error(name), { name }, extra);

type Opts = {
  sections?: ContextSections; provenance?: { section: string; type: string; id: string; projectId: string }[]; row?: any; now?: Date; date?: string;
  run?: (call: any) => Promise<LlmResult>; regenerate?: () => Promise<void>; open?: () => Promise<string>; member?: boolean; upsertError?: Error; flaggedSummary?: boolean; sanitiseFlag?: boolean;
};

function harness(o: Opts = {}) {
  const log = { runs: 0, opens: 0, regens: 0, hits: [] as any[], assembles: 0, commits: 0, inTx: false, inTxDuringRun: false };
  let stored: any = o.row ?? null;
  const sections = o.sections ?? [sec("task-events", "line a\nline b")];
  const provenance = o.provenance ?? [];
  const tx = {
    project: { update: async () => ({}), findFirst: async () => ({ status: "ACTIVE" }) },
    standup: {
      upsert: async ({ create, update }: any) => {
        if (o.upsertError) throw o.upsertError;
        stored = stored ? { ...stored, ...update, version: stored.version + update.version.increment } : { id: "s1", outcome: null, feedback: null, createdAt: NOW, updatedAt: NOW, ...create };
        return stored;
      },
    },
  };
  const write = { db: { $transaction: async (fn: any) => { log.inTx = true; try { const r = await fn(tx); log.commits++; return r; } finally { log.inTx = false; } } } as never, requireMember: async () => { if (o.member === false) throw new NotMember(U, P); } };
  const db = {
    standup: { findFirst: async () => stored },
    itemSummary: { findMany: async () => (o.flaggedSummary ? [{ itemId: "i1", flagged: true }] : []) },
    activityItem: { findMany: async () => [{ id: "i1" }] },
  };
  const deps: StandupFlowDeps = {
    db, write, now: () => o.now ?? NOW,
    ai: { assembleWith: async () => { log.assembles++; return { sections, provenance: provenance as any }; } },
    gateway: { run: async (call: any) => { log.runs++; log.inTxDuringRun = log.inTx; return (o.run ?? (async () => okResult({ yesterday: ["m"], today: ["t"], blockers: [] })))(call); } },
    sessions: {
      open: async () => { log.opens++; return o.open ? o.open() : `new-${log.opens}`; },
      regenerate: async () => { log.regens++; if (o.regenerate) await o.regenerate(); },
    },
    recordCacheHit: async (i) => { log.hits.push(i); }, sanitiseFlag: () => o.sanitiseFlag ?? false, checkLine,
  };
  return { deps, log, stored: () => stored, call: () => generateStandup(deps, { userId: U, role: "DEVELOPER" }, P, o.date ?? DATE) };
}

const hashOf = (sections: ContextSections, provenance: any[] = [], date = DATE) => standupInputHash(date, sections, provenance);
const rowFor = (sections: ContextSections, over: Record<string, unknown> = {}) => ({
  id: "s1", projectId: P, developerId: U, standupDate: new Date(`${DATE}T00:00:00Z`), content: { yesterday: ["old"], today: [], blockers: [] }, degraded: false, flagged: false, outcome: null, feedback: null,
  createdAt: NOW, updatedAt: NOW, version: 3, inputHash: hashOf(sections), sessionId: "sess", ...over,
});

test("E26 unchanged input returns the stored row cached with one cache hit and no run or regenerate", async () => {
  const sections = [sec("task-events", "line a")];
  const h = harness({ sections, row: rowFor(sections) });
  const s = await h.call();
  assert.equal(s.cached, true);
  assert.equal(s.version, 3);
  assert.deepEqual([h.log.runs, h.log.regens, h.log.opens, h.log.hits.length], [0, 0, 0, 1]);
  assert.deepEqual(h.log.hits[0], { feature: "DEV_STANDUP", caller: { userId: U, role: "DEVELOPER" }, sessionId: "sess", projectId: P, inputHash: hashOf(sections), promptVersion: STANDUP_PROMPT_VERSION });
});

test("E32 stored degraded row with unchanged input is returned cached without a run", async () => {
  const sections = [sec("task-events", "line a")];
  const h = harness({ sections, row: rowFor(sections, { degraded: true }) });
  const s = await h.call();
  assert.deepEqual([s.cached, s.degraded, h.log.runs], [true, true, 0]);
});

test("F4 an invalid or past date gives VALIDATION_FAILED 422", async () => {
  const h = harness({ date: "2026-11-01" });
  await assert.rejects(h.call(), (e: any) => e instanceof DevError && e.code === "VALIDATION_FAILED" && e.status === 422);
  assert.equal(h.log.assembles, 0);
});

test("E76 empty window skips assembleWith and stores empty content", async () => {
  const h = harness({ now: new Date("2026-11-08T16:00:00Z"), date: "2026-11-10" });
  const s = await h.call();
  assert.equal(h.log.assembles, 0);
  assert.deepEqual([s.content, h.log.runs, h.log.opens, s.degraded], [{ yesterday: [], today: [], blockers: [] }, 0, 1, false]);
});

test("E27 a changed input regenerates the stored session and bumps the version", async () => {
  const old = [sec("task-events", "old")];
  const h = harness({ sections: [sec("task-events", "old\nnew")], row: rowFor(old) });
  const s = await h.call();
  assert.deepEqual([h.log.regens, h.log.opens, h.log.runs, s.version, s.cached], [1, 0, 1, 4, false]);
  assert.equal(h.stored().sessionId, "sess");
});

test("E28 SessionCapReached on regenerate gives 429 RATE_LIMITED, no open and the row unchanged", async () => {
  const row = rowFor([sec("task-events", "old")]);
  const h = harness({ row, regenerate: async () => { throw named("SessionCapReached", { retryAfterSeconds: 120 }); } });
  await assert.rejects(h.call(), (e: any) => e instanceof DevError && e.code === "RATE_LIMITED" && e.status === 429 && e.retryAfterSeconds === 120);
  assert.deepEqual([h.log.opens, h.log.runs, h.stored()], [0, 0, row]);
});

test("E29 an abandoned stored session opens a new one that is stored on the row", async () => {
  for (const code of ["CONFLICT_STATE", "NOT_FOUND"]) {
    const h = harness({ row: rowFor([sec("task-events", "old")]), regenerate: async () => { throw new Error(code); } });
    await h.call();
    assert.deepEqual([h.log.opens, h.stored().sessionId], [1, "new-1"]);
  }
});

test("E30 no content opens a session, makes no run and stores empty lists", async () => {
  const h = harness({ sections: [sec("task-events", "  \n"), sec("blocked-tasks", "")] });
  const s = await h.call();
  assert.deepEqual([h.log.opens, h.log.runs, s.content, s.degraded], [1, 0, { yesterday: [], today: [], blockers: [] }, false]);
});

test("E56 open throwing SessionCapReached gives 429 RATE_LIMITED with Retry-After", async () => {
  const h = harness({ open: async () => { throw named("SessionCapReached", { retryAfterSeconds: 60 }); } });
  await assert.rejects(h.call(), (e: any) => e instanceof DevError && e.code === "RATE_LIMITED" && e.status === 429 && e.retryAfterSeconds === 60);
  assert.equal(h.stored(), null);
});

test("E31 non-busy failures give a degraded 200 with code-built lines", async () => {
  const sections = [sec("task-events", "e1\ne2"), sec("blocked-tasks", "b1")];
  const failures: Opts["run"][] = [
    ...(["AI_DISABLED", "AI_UNAVAILABLE", "REQUEST_REFUSED", "BLOCKED_INPUT"] as const).map((code) => async (): Promise<LlmResult> => ({ ok: false, code })),
    async () => { throw new Error("LLM_CALL_FAILED"); },
  ];
  for (const run of failures) {
    const s = await harness({ sections, run }).call();
    assert.deepEqual([s.degraded, s.content], [true, { yesterday: ["e1", "e2"], today: [], blockers: ["b1"] }]);
  }
});

test("F5 invalid model output degrades to the task-event lines", async () => {
  const s = await harness({ sections: [sec("task-events", "one\ntwo")], run: async () => okResult("not json") }).call();
  assert.deepEqual([s.degraded, s.content.yesterday], [true, ["one", "two"]]);
});

test("E33 AI_BUSY gives 429 with LOCAL_LIMIT details and nothing stored", async () => {
  const h = harness({ run: async () => ({ ok: false, code: "AI_BUSY", retryAfterSeconds: 7 }) });
  await assert.rejects(h.call(), (e: any) => e instanceof DevError && e.code === "AI_BUSY" && e.status === 429 && e.retryAfterSeconds === 7 && e.details?.[0]?.message === "LOCAL_LIMIT" && e.details[0].field === "reason");
  assert.equal(h.stored(), null);
});

test("ROLE_DENIED from the gateway becomes INTERNAL_ERROR 500", async () => {
  await assert.rejects(harness({ run: async () => ({ ok: false, code: "ROLE_DENIED" }) }).call(), (e: any) => e instanceof DevError && e.status === 500);
});

test("E63 a caller removed during the model call gives NOT_FOUND and writes nothing", async () => {
  const h = harness({ member: false });
  await assert.rejects(h.call(), { message: "NOT_FOUND" });
  assert.equal(h.stored(), null);
});

test("E64 an upsert failure after run propagates and leaves the prior row", async () => {
  const row = rowFor([sec("task-events", "old")]);
  const h = harness({ row, upsertError: new Error("boom") });
  await assert.rejects(h.call(), { message: "boom" });
  assert.equal(h.stored(), row);
});

test("NotMember from assembleWith becomes NOT_FOUND", async () => {
  const h = harness();
  h.deps.ai = { assembleWith: async () => { throw new NotMember(U, P); } };
  await assert.rejects(h.call(), { message: "NOT_FOUND" });
});

test("E66 degraded path keeps 12 lines cut to 300 and flags a flagged included summary", async () => {
  const lines = Array.from({ length: 13 }, (_, i) => (i === 0 ? "x".repeat(400) : `event ${i}`));
  const h = harness({
    sections: [sec("task-events", lines.join("\n"))], provenance: [{ section: "item-summaries", type: "ITEM_SUMMARY", id: "sum1", projectId: P }],
    flaggedSummary: true, run: async () => ({ ok: false, code: "AI_UNAVAILABLE" }),
  });
  const s = await h.call();
  assert.equal(s.content.yesterday.length, 12);
  assert.equal(Math.max(...s.content.yesterday.map((l) => l.length)), 300);
  assert.equal(s.flagged, true);
});

test("E66 a cut that would split a surrogate pair drops one more unit", async () => {
  const text = `${"a".repeat(299)}\u{1F600}`;
  const s = await harness({ sections: [sec("task-events", text)], run: async () => ({ ok: false, code: "AI_UNAVAILABLE" }) }).call();
  assert.equal(s.content.yesterday[0], "a".repeat(299));
});

test("E70 a flagged included summary flags an ok model result", async () => {
  const s = await harness({ provenance: [{ section: "item-summaries", type: "ITEM_SUMMARY", id: "sum1", projectId: P }], flaggedSummary: true }).call();
  assert.deepEqual([s.degraded, s.flagged], [false, true]);
});

test("a flagged model result or a sanitiser flag flags the standup", async () => {
  assert.equal((await harness({ run: async () => okResult({ yesterday: [], today: [], blockers: [] }, true) }).call()).flagged, true);
  assert.equal((await harness({ sanitiseFlag: true }).call()).flagged, true);
  assert.equal((await harness().call()).flagged, false);
});

test("E71 an unsafe blocked reason is hidden and flags the standup", async () => {
  const s = await harness({ sections: [sec("blocked-tasks", 'waiting <a href="x">here</a>')], run: async () => ({ ok: false, code: "AI_UNAVAILABLE" }) }).call();
  assert.deepEqual([s.content.blockers, s.flagged], [["(line hidden: unsafe text)"], true]);
});

test("N2 N4 one run outside any transaction and one committed transaction", async () => {
  const sections = [sec("task-events", "a")];
  const h = harness({ sections });
  let seen: any;
  h.deps.gateway = { run: async (call) => { seen = call; assert.equal(h.log.inTx, false); h.log.runs++; return okResult({ yesterday: ["m"], today: [], blockers: [] }); } };
  await h.call();
  assert.deepEqual([h.log.runs, h.log.commits], [1, 1]);
  const all = withStatics(STANDUP_STATIC, sections);
  assert.equal(seen.inputHash, sectionsInputHash(all));
  assert.deepEqual([seen.feature, seen.sessionId, seen.output.kind], ["DEV_STANDUP", "new-1", "json"]);
  const g = harness({ sections });
  await g.call();
  assert.deepEqual([g.log.inTxDuringRun, g.log.runs, g.log.commits], [false, 1, 1]);
});
