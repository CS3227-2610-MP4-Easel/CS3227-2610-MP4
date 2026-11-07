import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { FEATURES } from "@agile/llm-gateway";
import { ALLOW_LIST, FACT_KEYS, FEATURE_ROLES, registerContextSource, registerCore, SOURCE_IDS } from "../src/index.js";
import { resetContextRegistries } from "../src/testing.js";

afterEach(() => resetContextRegistries());

const row = (name: string, sourceId: string, kind: string, priority: number, budgetTokens: number, trusted: boolean, types: string[], scope: string[], maxRows: number, maxChars: number) =>
  ({ name, sourceId, kind, priority, budgetTokens, trusted, types, scope, maxRows, maxChars });

test("F1 the allow-list equals spec api.md § Allow-list, field by field", () => {
  const pm = (brief: number, checkpoints: number, similar: number) => [
    row("project-brief", "core.projectBrief", "DYNAMIC", 1, brief, false, ["PROJECT"], ["target"], 1, 4300),
    row("checkpoints", "core.checkpoints", "DYNAMIC", 2, checkpoints, false, ["CHECKPOINT"], ["target"], 50, 300),
    row("similar-items", "pm.similarItems", "RETRIEVED", 3, similar, false, ["EPIC", "TASK"], ["member"], 5, 200),
  ];
  assert.deepEqual(ALLOW_LIST, {
    PM_PLAN_OUTLINE: pm(1200, 400, 600),
    PM_PLAN_EXPAND: pm(800, 300, 400),
    LEAD_DIGEST: [
      row("facts", "lead.facts", "DYNAMIC", 1, 1500, true, ["FACTS"], ["target", "format"], 200, 52),
      row("changes", "lead.changes", "DYNAMIC", 2, 1200, false, ["TASK_EVENT"], ["target"], 200, 400),
      row("previous-digest", "lead.previousDigest", "DYNAMIC", 3, 800, false, ["DIGEST"], ["target"], 1, 4000),
    ],
    DEV_SUMMARY: [row("activity-items", "dev.activityItems", "DYNAMIC", 1, 2500, false, ["ACTIVITY_ITEM"], ["target", "own", "requested"], 10, 2600)],
    DEV_STANDUP: [
      row("item-summaries", "dev.itemSummaries", "DYNAMIC", 1, 1200, false, ["ITEM_SUMMARY"], ["target", "own"], 100, 300),
      row("task-events", "core.taskEvents", "DYNAMIC", 2, 800, false, ["TASK_EVENT"], ["target", "own"], 200, 400),
      row("blocked-tasks", "core.blockedTasks", "DYNAMIC", 3, 500, false, ["TASK"], ["target", "own"], 50, 800),
    ],
  });
  assert.deepEqual([...SOURCE_IDS].sort(), [
    "core.blockedTasks", "core.checkpoints", "core.projectBrief", "core.taskEvents", "dev.activityItems", "dev.itemSummaries",
    "lead.changes", "lead.facts", "lead.previousDigest", "pm.similarItems",
  ]);
});

test("F1 the fact keys equal spec api.md § Fact keys, and facts' max chars is the longest valid row", () => {
  assert.deepEqual(FACT_KEYS, {
    points_total: "number", points_done: "number", progress_percent: "number", unestimated_tasks: "number", avg_velocity: "number",
    points_remaining: "number", sprints_needed: "number", active_sprint: "uuid", blocked_tasks: "number", projected_completion_date: "date",
    checkpoint: "uuid", checkpoint_remaining_points: "number", checkpoint_projected_date: "date", checkpoint_target_date: "date",
    checkpoint_risk: "risk", overloaded_user: "uuid", overloaded_user_open_points: "number", overloaded_user_avg_points: "number",
  });
  const longestValue = { number: 23, uuid: 36, date: 10, risk: 8 } as const; // -<15 digits>.<6 digits>; uuid; YYYY-MM-DD; ON_TRACK/UNKNOWN/AT_RISK
  const longest = Math.max(...Object.entries(FACT_KEYS).map(([key, kind]) => key.length + 1 + longestValue[kind]));
  assert.equal(ALLOW_LIST.LEAD_DIGEST[0].maxChars, longest);
});

test("E33 N5 feature roles match the gateway both ways; only lead.facts is trusted", () => {
  assert.deepEqual(Object.keys(FEATURE_ROLES).sort(), Object.keys(FEATURES).sort());
  for (const [feature, config] of Object.entries(FEATURES)) assert.equal(FEATURE_ROLES[feature as keyof typeof FEATURE_ROLES], config.role, feature);
  const trusted = Object.values(ALLOW_LIST).flat().filter((section) => section.trusted).map((section) => section.sourceId);
  assert.deepEqual(trusted, ["lead.facts"]);
});

test("E9 F7 unknown source ids and non-function sources are refused", () => {
  assert.throws(() => registerContextSource("lead.unknown" as never, async () => []), { message: "UNKNOWN_CONTEXT_SOURCE" });
  assert.throws(() => registerContextSource("lead.facts", "not a function" as never), { message: "INVALID_CONTEXT_SOURCE" });
});

test("E37 F7 duplicate registrations throw and keep the first; reset allows registering again", () => {
  const first = async () => [];
  registerContextSource("core.checkpoints", first);
  assert.throws(() => registerContextSource("core.checkpoints", async () => []), { message: "SOURCE_ALREADY_REGISTERED" });
  const core = { requireMember: async () => {} };
  registerCore(core);
  assert.throws(() => registerCore({ requireMember: async () => {} }), { message: "CORE_ALREADY_REGISTERED" });
  resetContextRegistries();
  assert.doesNotThrow(() => registerContextSource("core.checkpoints", async () => []));
  assert.doesNotThrow(() => registerCore(core));
});
