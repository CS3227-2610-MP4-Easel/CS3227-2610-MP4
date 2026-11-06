import { z } from "zod";
import type { Feature, UserRole } from "@agile/contracts";

export type EntityType = "PROJECT" | "CHECKPOINT" | "EPIC" | "TASK" | "TASK_EVENT" | "FACTS" | "DIGEST" | "ACTIVITY_ITEM" | "ITEM_SUMMARY";
export const ENTITY_TYPES: readonly EntityType[] = ["PROJECT", "CHECKPOINT", "EPIC", "TASK", "TASK_EVENT", "FACTS", "DIGEST", "ACTIVITY_ITEM", "ITEM_SUMMARY"];

export const SOURCE_IDS = [
  "core.projectBrief", "core.checkpoints", "core.taskEvents", "core.blockedTasks", "pm.similarItems",
  "lead.facts", "lead.changes", "lead.previousDigest", "dev.activityItems", "dev.itemSummaries",
] as const;
export type SourceId = (typeof SOURCE_IDS)[number];

/** target: rows of the target project; member: rows of any project the caller belongs to; own: the caller's rows;
 * requested: only the requested item ids; format: the trusted key=value vocabulary (spec api.md § Allow-list). */
export type Scope = "target" | "member" | "own" | "requested" | "format";
export type SectionSpec = {
  name: string; sourceId: SourceId; kind: "STATIC" | "RETRIEVED" | "DYNAMIC"; priority: number; budgetTokens: number; trusted: boolean;
  types: EntityType[]; scope: Scope[]; maxRows: number; maxChars: number;
};

const section = (name: string, sourceId: SourceId, kind: SectionSpec["kind"], priority: number, budgetTokens: number, trusted: boolean, types: EntityType[], scope: Scope[], maxRows: number, maxChars: number): SectionSpec =>
  ({ name, sourceId, kind, priority, budgetTokens, trusted, types, scope, maxRows, maxChars });

const pmSections = (brief: number, checkpoints: number, similar: number) => [
  section("project-brief", "core.projectBrief", "DYNAMIC", 1, brief, false, ["PROJECT"], ["target"], 1, 4300),
  section("checkpoints", "core.checkpoints", "DYNAMIC", 2, checkpoints, false, ["CHECKPOINT"], ["target"], 50, 300),
  section("similar-items", "pm.similarItems", "RETRIEVED", 3, similar, false, ["EPIC", "TASK"], ["member"], 5, 200),
];

/** The only sections each feature may receive, in the order they are returned (spec api.md § Allow-list). */
export const ALLOW_LIST: Readonly<Record<Feature, readonly SectionSpec[]>> = {
  PM_PLAN_OUTLINE: pmSections(1200, 400, 600),
  PM_PLAN_EXPAND: pmSections(800, 300, 400),
  LEAD_DIGEST: [
    // The only trusted section: it skips the W3 pipeline, so its rows are a closed key=value vocabulary (FACT_KEYS).
    section("facts", "lead.facts", "DYNAMIC", 1, 1500, true, ["FACTS"], ["target", "format"], 200, 52),
    section("changes", "lead.changes", "DYNAMIC", 2, 1200, false, ["TASK_EVENT"], ["target"], 200, 400),
    section("previous-digest", "lead.previousDigest", "DYNAMIC", 3, 800, false, ["DIGEST"], ["target"], 1, 4000),
  ],
  DEV_SUMMARY: [section("activity-items", "dev.activityItems", "DYNAMIC", 1, 2500, false, ["ACTIVITY_ITEM"], ["target", "own", "requested"], 10, 2600)],
  DEV_STANDUP: [
    section("item-summaries", "dev.itemSummaries", "DYNAMIC", 1, 1200, false, ["ITEM_SUMMARY"], ["target", "own"], 100, 300),
    section("task-events", "core.taskEvents", "DYNAMIC", 2, 800, false, ["TASK_EVENT"], ["target", "own"], 200, 400),
    section("blocked-tasks", "core.blockedTasks", "DYNAMIC", 3, 500, false, ["TASK"], ["target", "own"], 50, 800),
  ],
};

export const FEATURE_ROLES: Readonly<Record<Feature, UserRole>> = {
  PM_PLAN_OUTLINE: "PM", PM_PLAN_EXPAND: "PM", LEAD_DIGEST: "DEV_LEAD", DEV_SUMMARY: "DEVELOPER", DEV_STANDUP: "DEVELOPER",
};

export type FactKind = "number" | "uuid" | "date" | "risk";
/** The closed vocabulary of the trusted facts section (spec api.md § Fact keys); W8 adds keys here by PR. */
export const FACT_KEYS: Readonly<Record<string, FactKind>> = {
  points_total: "number", points_done: "number", progress_percent: "number", unestimated_tasks: "number", avg_velocity: "number",
  points_remaining: "number", sprints_needed: "number", active_sprint: "uuid", blocked_tasks: "number", projected_completion_date: "date",
  checkpoint: "uuid", checkpoint_remaining_points: "number", checkpoint_projected_date: "date", checkpoint_target_date: "date",
  checkpoint_risk: "risk", overloaded_user: "uuid", overloaded_user_open_points: "number", overloaded_user_avg_points: "number",
};
export const FACT_VALUE_PATTERNS: Readonly<Record<FactKind, RegExp>> = {
  number: /^-?[0-9]{1,15}(\.[0-9]{1,6})?$/,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
  date: /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/,
  risk: /^(AT_RISK|ON_TRACK|UNKNOWN)$/,
};

const pmOptions = z.object({ query: z.string().min(1).max(6000).optional() }).strict();
export const OPTION_SCHEMAS = {
  PM_PLAN_OUTLINE: pmOptions,
  PM_PLAN_EXPAND: pmOptions,
  LEAD_DIGEST: z.object({}).strict(),
  DEV_SUMMARY: z.object({ itemIds: z.array(z.uuid()).min(1).max(10).refine((ids) => new Set(ids).size === ids.length) }).strict(),
  DEV_STANDUP: z.object({ window: z.object({ from: z.date(), to: z.date() }).strict().refine((w) => w.from < w.to) }).strict(),
} as const;
export type AssembleOptions = { query?: string; itemIds?: string[]; window?: { from: Date; to: Date } };
