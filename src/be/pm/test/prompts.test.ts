import assert from "node:assert/strict";
import { test } from "node:test";
import type { ContextSections, Feature, LlmCall } from "@agile/contracts";
import { assertStaticSectionsFit, checkOutput, FEATURES, mockRegistry, securitySuffix, PLACEHOLDER_BOUNDARY, estimateTokens } from "@agile/llm-gateway";
import { addDaysIso, expandOutputSchema, outlineOutputSchema, POINTS } from "../src/schemas.js";
import { buildExpandSections, buildOutlineSections, inputHash, outlineStaticSections, PM_PROMPT } from "../src/sections.js";
import "../src/mocks.js";

const TODAY = "2026-11-07";
const outline = outlineOutputSchema(TODAY);
const epic = (extra: Record<string, unknown> = {}) => ({ title: "Epic", description: "About the epic.", checkpointName: null, ...extra });
const valid = (extra: Record<string, unknown> = {}) => ({ approach: "Plan.", checkpoints: [{ name: "MVP", targetDate: addDaysIso(TODAY, 10) }], epics: [epic({ checkpointName: "MVP" })], ...extra });
const accepts = (schema: { safeParse(v: unknown): { success: boolean } }, value: unknown) => schema.safeParse(value).success;
const guard = (schema: unknown) => ({ kind: "json", schema }) as LlmCall["output"];
const ctx = { boundary: "bnd0123456789abcdef", secrets: [] as string[] };

const assembled: ContextSections = [{ name: "project-brief", kind: "DYNAMIC", priority: 1, budgetTokens: 1200, text: "Brief.", trusted: false }];
const statics = (sections: ContextSections) => sections.filter((s) => s.kind === "STATIC");

test("E46 static sections of both features fit, with the suffix, in maxPromptTokens", () => {
  const out = buildOutlineSections({ today: TODAY, idea: "An idea.", assembled });
  const exp = buildExpandSections({ approach: "Approach.", epic: { title: "T", description: "D" }, assembled });
  assert.doesNotThrow(() => assertStaticSectionsFit("PM_PLAN_OUTLINE", outlineStaticSections()));
  assert.doesNotThrow(() => assertStaticSectionsFit("PM_PLAN_OUTLINE", out));
  assert.doesNotThrow(() => assertStaticSectionsFit("PM_PLAN_EXPAND", exp));
  for (const [feature, sections] of [["PM_PLAN_OUTLINE", statics(out)], ["PM_PLAN_EXPAND", statics(exp)]] as Array<[Feature, ContextSections]>) {
    const model = FEATURES[feature].model;
    const total = sections.reduce((sum, s) => sum + estimateTokens(`## ${s.name}\n${s.text}`, model), 0) + estimateTokens(securitySuffix(PLACEHOLDER_BOUNDARY), model);
    assert.ok(total <= FEATURES[feature].maxPromptTokens, `${feature} statics ${total}`);
    for (const s of sections) assert.ok(estimateTokens(`## ${s.name}\n${s.text}`, model) <= s.budgetTokens, `${feature}/${s.name} within its budget`);
  }
});

test("section order, budgets and trust flags", () => {
  assert.deepEqual(outlineStaticSections().map((s) => [s.name, s.kind, s.priority, s.trusted]), [["rules", "STATIC", 0, true], ["output-format", "STATIC", 0, true]]);
  const out = buildOutlineSections({ today: TODAY, idea: "idea text", assembled });
  assert.deepEqual(out.map((s) => s.name), ["rules", "output-format", "today", "project-brief", "idea"]);
  const today = out.find((s) => s.name === "today");
  assert.deepEqual([today?.kind, today?.trusted, today?.priority, today?.budgetTokens, today?.text], ["DYNAMIC", true, 0, PM_PROMPT.outline.today, TODAY]);
  const idea = out.find((s) => s.name === "idea");
  assert.deepEqual([idea?.kind, idea?.trusted, idea?.priority, idea?.budgetTokens, idea?.text], ["DYNAMIC", false, 0, PM_PROMPT.outline.idea, "idea text"]);
  assert.deepEqual(out.slice(0, 2).map((s) => s.budgetTokens), [PM_PROMPT.outline.rules, PM_PROMPT.outline.outputFormat]);
  const exp = buildExpandSections({ approach: "the approach", epic: { title: "Title", description: "Desc" }, assembled });
  assert.deepEqual(exp.map((s) => s.name), ["rules", "output-format", "project-brief", "approach", "epic"]);
  for (const name of ["approach", "epic"]) {
    const s = exp.find((x) => x.name === name);
    assert.deepEqual([s?.kind, s?.trusted, s?.priority], ["DYNAMIC", false, 0]);
  }
  assert.equal(exp.find((s) => s.name === "approach")?.budgetTokens, PM_PROMPT.expand.approach);
  assert.equal(exp.find((s) => s.name === "epic")?.budgetTokens, PM_PROMPT.expand.epic);
  assert.equal(exp.find((s) => s.name === "epic")?.text, "title: Title\ndescription: Desc");
  assert.ok(statics(exp).every((s) => s.trusted) && statics(out).every((s) => s.trusted));
  // assembled sections are passed through untouched
  assert.deepEqual(out.find((s) => s.name === "project-brief"), assembled[0]);
});

test("inputHash is a stable sha256 over the feature and the texts", () => {
  const sections = buildOutlineSections({ today: TODAY, idea: "idea", assembled });
  const hash = inputHash("PM_PLAN_OUTLINE", sections);
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.equal(inputHash("PM_PLAN_OUTLINE", sections), hash);
  assert.notEqual(inputHash("PM_PLAN_EXPAND", sections), hash);
  assert.notEqual(inputHash("PM_PLAN_OUTLINE", buildOutlineSections({ today: TODAY, idea: "idea2", assembled })), hash);
});

test("outline schema accepts a valid answer and the boundaries", () => {
  assert.ok(accepts(outline, valid()));
  assert.ok(accepts(outline, valid({ checkpoints: [{ name: "A", targetDate: TODAY }, { name: "B", targetDate: addDaysIso(TODAY, 730) }], epics: [epic()] })));
  assert.ok(accepts(outline, valid({ checkpoints: [], epics: [epic()] })));
  // today computed at 00:30 Singapore time (16:30 UTC the day before)
  const sg = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date("2026-12-31T16:30:00Z"));
  assert.equal(sg, "2027-01-01");
  const sgSchema = outlineOutputSchema(sg);
  assert.ok(accepts(sgSchema, valid({ checkpoints: [{ name: "A", targetDate: sg }, { name: "B", targetDate: addDaysIso(sg, 730) }], epics: [epic()] })));
  assert.ok(!accepts(sgSchema, valid({ checkpoints: [{ name: "A", targetDate: "2026-12-31" }], epics: [epic()] })));
});

test("outline schema rejects the listed bad shapes", () => {
  const bad = (value: unknown) => assert.equal(accepts(outline, value), false);
  bad(valid({ epics: Array.from({ length: 11 }, () => epic()) }));
  bad(valid({ epics: [] }));
  bad(valid({ checkpoints: [{ name: "MVP", targetDate: TODAY }, { name: "mvp", targetDate: TODAY }], epics: [epic()] }));
  bad(valid({ checkpoints: [{ name: "mvp", targetDate: TODAY }, { name: "MVP", targetDate: TODAY }], epics: [epic()] }));
  bad(valid({ epics: [epic({ checkpointName: "Unlisted" })] }));
  bad(valid({ epics: [epic({ checkpointName: "mvp" })] }));
  bad(valid({ checkpoints: [{ name: "MVP", targetDate: addDaysIso(TODAY, -1) }] }));
  bad(valid({ checkpoints: [{ name: "MVP", targetDate: addDaysIso(TODAY, 731) }] }));
  bad(valid({ checkpoints: [{ name: "MVP", targetDate: "2026-02-30" }] }));
  bad(valid({ checkpoints: [{ name: "MVP", targetDate: "2026-1-5" }] }));
  bad(valid({ checkpoints: Array.from({ length: 9 }, (_, i) => ({ name: `C${i}`, targetDate: TODAY })) }));
  bad(valid({ approach: "" }));
  bad(valid({ approach: "x".repeat(1501) }));
  bad(valid({ epics: [epic({ title: "" })] }));
  bad(valid({ epics: [epic({ title: "x".repeat(201) })] }));
  bad(valid({ epics: [epic({ description: "x".repeat(1001) })] }));
  bad(valid({ epics: [epic({ checkpointName: undefined })] }));
  assert.throws(() => outlineOutputSchema("2026-02-30"));
});

test("expand schema accepts and rejects", () => {
  const task = (extra: Record<string, unknown> = {}) => ({ title: "Build", description: "Do it.", acceptanceCriteria: ["Works."], storyPoints: 3, ...extra });
  assert.ok(accepts(expandOutputSchema, { tasks: [task()] }));
  for (const p of POINTS) assert.ok(accepts(expandOutputSchema, { tasks: [task({ storyPoints: p })] }));
  assert.ok(accepts(expandOutputSchema, { tasks: Array.from({ length: 8 }, () => task()) }));
  assert.equal(accepts(expandOutputSchema, { tasks: Array.from({ length: 9 }, () => task()) }), false);
  assert.equal(accepts(expandOutputSchema, { tasks: [] }), false);
  assert.equal(accepts(expandOutputSchema, { tasks: [task({ storyPoints: 4 })] }), false);
  assert.equal(accepts(expandOutputSchema, { tasks: [task({ storyPoints: 0 })] }), false);
  assert.equal(accepts(expandOutputSchema, { tasks: [task({ acceptanceCriteria: [] })] }), false);
  assert.equal(accepts(expandOutputSchema, { tasks: [task({ acceptanceCriteria: Array(7).fill("x") })] }), false);
  assert.equal(accepts(expandOutputSchema, { tasks: [task({ acceptanceCriteria: ["x".repeat(301)] })] }), false);
  assert.equal(accepts(expandOutputSchema, { tasks: [task({ title: "x".repeat(201) })] }), false);
});

test("the output guard rejects a URL in a title for both schemas", () => {
  const url = valid({ epics: [epic({ title: "See https://evil.example/x" })] });
  const r = checkOutput(JSON.stringify(url), guard(outline), ctx);
  assert.equal(r.ok, false);
  const task = { tasks: [{ title: "Visit www.evil.example", description: "d", acceptanceCriteria: ["ok"], storyPoints: 2 }] };
  assert.equal(checkOutput(JSON.stringify(task), guard(expandOutputSchema), ctx).ok, false);
});

test("mock answers parse, satisfy the schemas and pass the output guard", () => {
  const outlineMock = mockRegistry.get("PM_PLAN_OUTLINE");
  const expandMock = mockRegistry.get("PM_PLAN_EXPAND");
  assert.ok(outlineMock && expandMock);
  const call = (feature: Feature, sections: ContextSections): LlmCall => ({ feature, caller: { userId: "00000000-0000-4000-8000-0000000000a1", role: "PM" }, sessionId: "00000000-0000-4000-8000-0000000000b1", projectId: "00000000-0000-4000-8000-0000000000c1", sections, output: { kind: "json", schema: null }, inputHash: "h" });
  const outText = outlineMock(call("PM_PLAN_OUTLINE", buildOutlineSections({ today: TODAY, idea: "idea", assembled })));
  const r = checkOutput(outText, guard(outline), ctx);
  assert.equal(r.ok, true);
  const parsed = JSON.parse(outText) as { approach: string; checkpoints: Array<{ name: string; targetDate: string }>; epics: Array<{ title: string; checkpointName: string | null }> };
  assert.equal(parsed.approach, "A short mock plan.");
  assert.deepEqual(parsed.checkpoints, [{ name: "MVP", targetDate: addDaysIso(TODAY, 28) }]);
  assert.deepEqual(parsed.epics.map((e) => [e.title, e.checkpointName]), [["Foundation", null], ["Core features", "MVP"], ["Release", null]].map(([t, c]) => [t, c]));
  const expText = expandMock(call("PM_PLAN_EXPAND", buildExpandSections({ approach: "a", epic: { title: "t", description: "d" }, assembled })));
  assert.equal(checkOutput(expText, guard(expandOutputSchema), ctx).ok, true);
  const tasks = (JSON.parse(expText) as { tasks: Array<{ title: string; storyPoints: number; acceptanceCriteria: string[] }> }).tasks;
  assert.deepEqual(tasks.map((t) => [t.title, t.storyPoints, t.acceptanceCriteria.length]), [["Design", 3, 1], ["Build", 5, 1], ["Test", 2, 1]]);
});
