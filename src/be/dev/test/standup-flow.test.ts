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
  run?: (call: any) => Promise<LlmResult>; regenerate?: () => Promise<void>; open?: () => Promise<string>; member?: boolean; upsertError?: Error; assembleError?: Error; flaggedSummary?: boolean; sanitiseFlag?: boolean;
};

function harness(o: Opts = {}) {
  const log = { runs: 0, opens: 0, regens: 0, hits: [] as any[], assembles: 0, commits: 0, upserts: 0, summaryLookups: [] as string[][], runSessions: [] as string[], openArgs: [] as any[], regenArgs: [] as any[], inTx: false, inTxDuringRun: false };
  let stored: any = o.row ?? null;
  const sections = o.sections ?? [sec("task-events", "line a\nline b")];
  const provenance = o.provenance ?? [];
  const tx = {
    project: { update: async () => ({}), findFirst: async () => ({ status: "ACTIVE" }) },
    standup: {
      upsert: async ({ create, update }: any) => {
        log.upserts++;
        if (o.upsertError) throw o.upsertError;
        stored = stored ? { ...stored, ...update, version: stored.version + update.version.increment } : { id: "s1", outcome: null, feedback: null, createdAt: NOW, updatedAt: NOW, ...create };
        return stored;
      },
    },
  };
  const write = { db: { $transaction: async (fn: any) => { log.inTx = true; try { const r = await fn(tx); log.commits++; return r; } finally { log.inTx = false; } } } as never, requireMember: async () => { if (o.member === false) throw new NotMember(U, P); } };
  const db = {
    standup: { findFirst: async () => stored },
    itemSummary: { findMany: async (a: any) => { log.summaryLookups.push(a.where.id.in); return o.flaggedSummary ? [{ itemId: "i1", flagged: true }] : []; } },
    activityItem: { findMany: async () => [{ id: "i1" }] },
  };
  const deps: StandupFlowDeps = {
    db, write, now: () => o.now ?? NOW,
    ai: { assembleWith: async () => { log.assembles++; if (o.assembleError) throw o.assembleError; return { sections, provenance: provenance as any }; } },
    gateway: { run: async (call: any) => { log.runs++; log.inTxDuringRun = log.inTx; log.runSessions.push(call.sessionId); return (o.run ?? (async () => okResult({ yesterday: ["m"], today: ["t"], blockers: [] })))(call); } },
    sessions: {
      open: async (i) => { log.opens++; log.openArgs.push(i); return o.open ? o.open() : `new-${log.opens}`; },
      regenerate: async (id, uid) => { log.regens++; log.regenArgs.push([id, uid]); if (o.regenerate) await o.regenerate(); },
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

test("ROLE_DENIED from the gateway becomes INTERNAL_ERROR 500 and stores nothing", async () => {
  const isInternal = (e: any) => e instanceof DevError && e.code === "INTERNAL_ERROR" && e.status === 500;
  const h = harness({ run: async () => ({ ok: false, code: "ROLE_DENIED" }) });
  await assert.rejects(h.call(), isInternal);
  assert.deepEqual([h.stored(), h.log.commits, h.log.upserts], [null, 0, 0]);
  const row = rowFor([sec("task-events", "old")]);
  const g = harness({ row, run: async () => ({ ok: false, code: "ROLE_DENIED" }) });
  await assert.rejects(g.call(), isInternal);
  assert.deepEqual([g.stored(), g.log.commits], [row, 0]);
});

test("E63 a caller removed during the model call gives NOT_FOUND and writes nothing", async () => {
  const h = harness({ member: false });
  await assert.rejects(h.call(), { message: "NOT_FOUND" });
  assert.deepEqual([h.stored(), h.log.runs, h.log.commits], [null, 1, 0]);
  const row = rowFor([sec("task-events", "old")]);
  const g = harness({ row, member: false });
  await assert.rejects(g.call(), { message: "NOT_FOUND" });
  assert.deepEqual([g.stored(), g.log.runs, g.log.commits], [row, 1, 0]);
});

test("N2 unexpected errors propagate unchanged and store nothing", async () => {
  const plain = new Error("something else");
  const inTx = new Error("LLM_CALL_IN_TRANSACTION");
  const scope = named("ContextScopeViolation");
  const source = new Error("CONTEXT_SOURCE_FAILED");
  const cases: [string, Opts, Error][] = [
    ["plain run error", { run: async () => { throw plain; } }, plain],
    ["LLM_CALL_IN_TRANSACTION", { run: async () => { throw inTx; } }, inTx],
    ["ContextScopeViolation", { assembleError: scope }, scope],
    ["CONTEXT_SOURCE_FAILED", { assembleError: source }, source],
    ["regenerate error", { row: rowFor([sec("task-events", "old")]), regenerate: async () => { throw plain; } }, plain],
  ];
  for (const [label, opts, err] of cases) {
    const h = harness(opts);
    await assert.rejects(h.call(), (e) => e === err, label);
    assert.deepEqual([h.log.upserts, h.log.commits], [0, 0], label);
    if (opts.row) assert.equal(h.log.opens, 0, label);
    if (!opts.row) assert.equal(h.stored(), null, label);
  }
});

test("NotMember from assembleWith becomes NOT_FOUND with no session, run or write", async () => {
  const h = harness({ assembleError: new NotMember(U, P) });
  await assert.rejects(h.call(), { message: "NOT_FOUND" });
  assert.deepEqual([h.log.opens, h.log.regens, h.log.runs, h.log.commits, h.stored()], [0, 0, 0, 0, null]);
});

test("E76 a non-member on the empty-window path gets NOT_FOUND with no session", async () => {
  const h = harness({ now: new Date("2026-11-08T16:00:00Z"), date: "2026-11-10", member: false });
  await assert.rejects(h.call(), { message: "NOT_FOUND" });
  assert.deepEqual([h.log.assembles, h.log.opens, h.log.regens, h.log.runs, h.log.commits, h.stored()], [0, 0, 0, 0, 0, null]);
});

test("F4 a malformed date gives 422 before assemble, open or run", async () => {
  for (const date of ["nope", "2026-13-45"]) {
    const h = harness({ date });
    await assert.rejects(h.call(), (e: any) => e instanceof DevError && e.status === 422);
    assert.deepEqual([h.log.assembles, h.log.opens, h.log.regens, h.log.runs], [0, 0, 0, 0]);
  }
});

test("F4 an ok model result is stored and returned unchanged, not degraded", async () => {
  const value = { yesterday: ["m1", "m2"], today: ["t"], blockers: ["b"] };
  const h = harness({ run: async () => okResult(value) });
  const s = await h.call();
  assert.deepEqual([s.content, s.degraded, h.stored().content, h.stored().degraded, h.log.upserts], [value, false, value, false, 1]);
});

test("session calls carry the right arguments and the run uses the session", async () => {
  const h = harness({ row: rowFor([sec("task-events", "old")]) });
  await h.call();
  assert.deepEqual([h.log.regenArgs, h.log.runSessions], [[["sess", U]], ["sess"]]);
  const g = harness();
  await g.call();
  assert.deepEqual([g.log.openArgs, g.log.runSessions], [[{ feature: "DEV_STANDUP", userId: U, projectId: P }], ["new-1"]]);
});

test("E56 regenerate NOT_FOUND then open SessionCapReached gives 429", async () => {
  const h = harness({ row: rowFor([sec("task-events", "old")]), regenerate: async () => { throw new Error("NOT_FOUND"); }, open: async () => { throw named("SessionCapReached", { retryAfterSeconds: 30 }); } });
  await assert.rejects(h.call(), (e: any) => e instanceof DevError && e.status === 429 && e.retryAfterSeconds === 30);
  assert.deepEqual([h.log.runs, h.log.commits], [0, 0]);
});

test("E33 AI_BUSY with a stored row leaves it unchanged and details are exact", async () => {
  const row = rowFor([sec("task-events", "old")]);
  const h = harness({ row, run: async () => ({ ok: false, code: "AI_BUSY", retryAfterSeconds: 9 }) });
  await assert.rejects(h.call(), (e: any) => e instanceof DevError && e.code === "AI_BUSY" && JSON.stringify(e.details) === JSON.stringify([{ field: "reason", message: "LOCAL_LIMIT" }]));
  assert.deepEqual([h.log.regens, h.stored(), h.log.upserts, h.log.commits], [1, row, 0, 0]);
});

test("N2 the degraded path also runs outside a transaction with one run and one upsert", async () => {
  const h = harness({ run: async () => ({ ok: false, code: "AI_UNAVAILABLE" }) });
  const s = await h.call();
  assert.deepEqual([h.log.inTxDuringRun, h.log.runs, h.log.upserts, h.log.commits, s.degraded, h.stored() !== null], [false, 1, 1, 1, true, true]);
});

test("E30 the empty case stores exactly one row", async () => {
  const h = harness({ sections: [sec("task-events", "")] });
  await h.call();
  assert.deepEqual([h.log.upserts, h.stored() !== null], [1, true]);
});

test("E66 summary ids reach the lookup, lines 12 and 13 are dropped, negatives are not flagged", async () => {
  const lines = Array.from({ length: 13 }, (_, i) => `event ${i}`);
  const prov = (type: string) => [{ section: "item-summaries", type, id: "sum1", projectId: P }];
  const fail = async (): Promise<LlmResult> => ({ ok: false, code: "AI_UNAVAILABLE" });
  const h = harness({ sections: [sec("task-events", lines.join("\n"))], provenance: prov("ITEM_SUMMARY"), flaggedSummary: true, run: fail });
  const s = await h.call();
  assert.deepEqual(h.log.summaryLookups, [["sum1"]]);
  assert.deepEqual([s.content.yesterday[11], s.content.yesterday.includes("event 12")], ["event 11", false]);
  assert.equal((await harness({ provenance: prov("ITEM_SUMMARY"), run: fail }).call()).flagged, false);
  assert.equal((await harness({ provenance: prov("TASK"), flaggedSummary: true, run: fail }).call()).flagged, false);
});

test("E66 a surrogate pair at units 298-299 stays whole and a 300-unit line is uncut", async () => {
  const pair = `${"a".repeat(298)}\u{1F600}${"b".repeat(10)}`;
  const exact = "c".repeat(300);
  const s = await harness({ sections: [sec("task-events", `${pair}\n${exact}`)], run: async () => ({ ok: false, code: "AI_UNAVAILABLE" }) }).call();
  assert.deepEqual(s.content.yesterday, [pair.slice(0, 300), exact]);
  assert.equal(s.content.yesterday[0].length, 300);
});

test("E31 a degraded request counts one run and stores a row", async () => {
  const h = harness({ run: async () => { throw new Error("LLM_CALL_FAILED"); } });
  await h.call();
  assert.deepEqual([h.log.runs, h.stored() !== null], [1, true]);
});

test("an ok result failing the flow's own parse stays degraded and keeps the model flag", async () => {
  const s = await harness({ run: async () => okResult({ bad: true }, true) }).call();
  assert.deepEqual([s.degraded, s.flagged], [true, true]);
});

test("E64 an upsert failure after run propagates and leaves the prior row", async () => {
  const row = rowFor([sec("task-events", "old")]);
  const h = harness({ row, upsertError: new Error("boom") });
  await assert.rejects(h.call(), { message: "boom" });
  assert.equal(h.stored(), row);
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
