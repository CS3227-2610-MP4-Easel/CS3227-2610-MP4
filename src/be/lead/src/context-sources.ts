import { registerContextSource, type ContextSource, type SourceArgs } from "@agile/ai-context";
import type { Facts } from "./facts.js";

type FindMany<T> = { findMany(args: Record<string, unknown>): Promise<T[]> };
export type LeadSourceDb = { taskEvent?: FindMany<any>; projectDigest?: FindMany<any> };
const CONTROL = /[\u0000-\u001f\u007f]/g;
const clean = (value: unknown, limit: number) => typeof value === "string" && value.length <= limit ? value.replace(CONTROL, " ") : "";
const row = (projectId: string, type: "FACTS" | "TASK_EVENT" | "DIGEST", id: string, text: string) => ({ projectId, ref: { type, id }, text });
const numberText = (value: number) => {
  const text = value.toFixed(6).replace(/\.?0+$/, "");
  return text === "-0" ? "0" : text;
};
const factText = (value: unknown) => value == null ? "null" : typeof value === "number" ? numberText(value) : String(value);

function factRows(projectId: string, facts: Facts) {
  const scalar: string[] = [];
  const values: Record<string, unknown> = {
    points_total: facts.pointsTotal, points_done: facts.pointsDone, progress_percent: facts.pointsTotal ? facts.pointsDone / facts.pointsTotal * 100 : 0,
    unestimated_tasks: facts.unestimatedTasks, avg_velocity: facts.avgVelocity, points_remaining: facts.pointsRemaining,
    sprints_needed: facts.avgVelocity && facts.pointsRemaining ? Math.ceil(facts.pointsRemaining / facts.avgVelocity) : null,
    active_sprint: null, blocked_tasks: null, projected_completion_date: facts.projectedCompletionDate,
  };
  for (const key of ["points_total", "points_done", "progress_percent", "unestimated_tasks", "avg_velocity", "points_remaining", "sprints_needed", "active_sprint", "blocked_tasks", "projected_completion_date"]) {
    scalar.push(`${key}=${factText(values[key])}`);
  }
  const checkpoints = facts.checkpoints.flatMap((checkpoint) => [
    `checkpoint=${checkpoint.id}`, `checkpoint_remaining_points=${factText(checkpoint.remainingPoints)}`, `checkpoint_projected_date=${checkpoint.projectedDate ?? "null"}`,
    `checkpoint_target_date=${checkpoint.targetDate}`, `checkpoint_risk=${checkpoint.risk}`,
  ]);
  const overload = facts.overload.flatMap((user) => [`overloaded_user=${user.userId}`, `overloaded_user_open_points=${factText(user.openPoints)}`, `overloaded_user_avg_points=${factText(user.avgCompletedPerSprint)}`]);
  return [...scalar, ...checkpoints, ...overload].filter((text) => [...text].length <= 52).slice(0, 200).map((text, i) => row(projectId, "FACTS", `facts-${String(i).padStart(3, "0")}`, text));
}

export function createLeadSources(db: LeadSourceDb, getFacts: (projectId: string) => Promise<Facts>): Record<"facts" | "changes" | "previousDigest", ContextSource> {
  const facts: ContextSource = async ({ projectId, captured }) => {
    const snapshot = (captured as { facts?: Facts } | undefined)?.facts;
    return factRows(projectId, snapshot ?? await getFacts(projectId));
  };
  const changes: ContextSource = async ({ projectId, options }) => {
    const now = new Date(); const requestedFrom = options.window?.from ?? new Date(now.getTime() - 30 * 86_400_000);
    const from = new Date(Math.max(requestedFrom.getTime(), now.getTime() - 31 * 86_400_000));
    const rows = await db.taskEvent?.findMany({ where: { projectId, at: { gte: from, lte: options.window?.to ?? now } }, orderBy: [{ at: "desc" }, { id: "desc" }], take: 200 }) ?? [];
    return rows.map((event) => row(projectId, "TASK_EVENT", String(event.id), `${new Date(event.at).toISOString()} ${clean(event.type, 40)} ${clean(event.taskId, 36)} ${clean(event.fromValue, 120)} -> ${clean(event.toValue, 120)}`));
  };
  const previousDigest: ContextSource = async ({ projectId }) => {
    const [digest] = await db.projectDigest?.findMany({ where: { projectId }, orderBy: [{ factsAsOf: "desc" }, { createdAt: "desc" }, { id: "desc" }], take: 1, select: { id: true, explanation: true } }) ?? [];
    const explanation = clean(digest?.explanation, 4000);
    return explanation ? [row(projectId, "DIGEST", String(digest.id), explanation)] : [];
  };
  return { facts, changes, previousDigest };
}

export function registerLeadSources(sources: ReturnType<typeof createLeadSources>): void {
  for (const [id, source] of [["lead.facts", sources.facts], ["lead.changes", sources.changes], ["lead.previousDigest", sources.previousDigest]] as const) registerContextSource(id, source);
}
