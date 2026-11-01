import { AuthStateSchema, PredicateSchema, RoleAliasSchema, UserRoleSchema, type UserRole } from "./enums.js";
import type { z } from "zod";

export type AuthState = z.infer<typeof AuthStateSchema>;
export type Predicate = z.infer<typeof PredicateSchema>;
export type RoleAlias = z.infer<typeof RoleAliasSchema>;

export type PolicyEntry = {
  policyKey: string;
  operationId: string;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  authState: AuthState;
  roles: UserRole[];
  predicate: Predicate;
  requestSchema?: Record<string, unknown>;
  responseSchema: Record<string, unknown>;
  successStatus: 200 | 201 | 204;
};

export function translateRoleAlias(role: RoleAlias): UserRole {
  if (role === "LEAD" || role === "DEV_LEAD") return "DEV_LEAD";
  if (role === "DEV" || role === "DEVELOPER") return "DEVELOPER";
  return "PM";
}

const roles = (...values: RoleAlias[]) => values.map(translateRoleAlias);
const operationIds = [
  "HEALTH_READ", "AUTH_CODE_CHECK", "AUTH_REGISTER", "ME_READ", "PM_PROJECT_CREATE", "PROJECT_LIST", "PROJECT_READ", "PM_PROJECT_UPDATE", "PROJECT_MEMBER_LIST", "PROJECT_MEMBER_ADD", "PROJECT_MEMBER_REMOVE",
  "CHECKPOINT_LIST", "CHECKPOINT_CREATE", "CHECKPOINT_UPDATE", "CHECKPOINT_DELETE", "EPIC_LIST", "EPIC_CREATE", "EPIC_UPDATE", "EPIC_DELETE", "TASK_LIST", "TASK_CREATE", "TASK_READ", "TASK_UPDATE", "TASK_STATUS_UPDATE", "TASK_DELETE", "TASK_EVENT_LIST",
  "SPRINT_LIST", "SPRINT_CREATE", "SPRINT_UPDATE", "SPRINT_START", "SPRINT_CLOSE", "SPRINT_DELETE", "PROJECT_PROGRESS_READ", "PM_PLAN_CREATE", "PM_PROPOSAL_READ", "PM_PROPOSAL_LIST", "PM_EPIC_EXPAND", "PM_EPIC_UPDATE", "PM_EPIC_REGENERATE", "PM_PROPOSAL_APPROVE", "PM_PROPOSAL_REJECT",
  "LEAD_FACTS_READ", "LEAD_OVERVIEW_READ", "LEAD_DIGEST_CREATE", "LEAD_DIGEST_LATEST_READ", "LEAD_PROPOSAL_LIST", "LEAD_PROPOSAL_APPROVE", "LEAD_PROPOSAL_REJECT", "DEV_UPLOAD_CREATE", "DEV_SUMMARY_CREATE", "DEV_STANDUP_CREATE", "DEV_STANDUP_MINE_READ", "DEV_STANDUP_UPDATE", "DEV_STANDUP_FEEDBACK", "LEAD_STANDUP_LIST", "USAGE_SESSION_LIST", "USAGE_SUMMARY_READ",
] as const;
if (operationIds.length !== 57) throw new Error("operation id map must contain exactly 57 entries");
const successStatuses = new Map<number, 200 | 201 | 204>([
  [3, 201], [5, 201], [10, 201], [13, 201], [17, 201], [21, 201], [28, 201], [34, 201],
  [11, 204], [15, 204], [19, 204], [25, 204], [32, 204],
]);
const p = (n: number, method: PolicyEntry["method"], path: string, authState: AuthState, roleValues: RoleAlias[] = [], predicate: Predicate = "NONE"): PolicyEntry => ({
  policyKey: `endpoint-${n}`, operationId: operationIds[n - 1], method, path, authState, roles: roles(...roleValues), predicate,
  requestSchema: method === "GET" || method === "DELETE" ? undefined : { $ref: `#/components/schemas/${operationIds[n - 1]}Request` },
  responseSchema: { $ref: `#/components/schemas/${operationIds[n - 1]}Response` },
  successStatus: successStatuses.get(n) ?? 200,
});

const POLICY_MAP: PolicyEntry[] = [
  p(1, "GET", "/api/health", "PUBLIC"), p(2, "POST", "/api/auth/check-code", "PUBLIC"), p(3, "POST", "/api/auth/register", "TOKEN"), p(4, "GET", "/api/me", "REGISTERED"),
  p(5, "POST", "/api/pm/projects", "REGISTERED", ["PM"]), p(6, "GET", "/api/projects", "REGISTERED", [], "MEMBER"), p(7, "GET", "/api/projects/{projectId}", "REGISTERED", [], "MEMBER"), p(8, "PATCH", "/api/pm/projects/{projectId}", "REGISTERED", ["PM"], "MEMBER"), p(9, "GET", "/api/projects/{projectId}/members", "REGISTERED", [], "MEMBER"), p(10, "POST", "/api/projects/{projectId}/members", "REGISTERED", ["PM", "LEAD"], "ADDER"), p(11, "DELETE", "/api/projects/{projectId}/members/{userId}", "REGISTERED", ["PM", "LEAD"], "ADDER"),
  p(12, "GET", "/api/projects/{id}/checkpoints", "REGISTERED", [], "MEMBER"), p(13, "POST", "/api/projects/{id}/checkpoints", "REGISTERED", ["PM", "LEAD"], "MEMBER"), p(14, "PATCH", "/api/checkpoints/{id}", "REGISTERED", ["PM", "LEAD"], "MEMBER"), p(15, "DELETE", "/api/checkpoints/{id}", "REGISTERED", ["PM", "LEAD"], "MEMBER"), p(16, "GET", "/api/projects/{id}/epics", "REGISTERED", [], "MEMBER"), p(17, "POST", "/api/projects/{id}/epics", "REGISTERED", ["PM", "LEAD"], "MEMBER"), p(18, "PATCH", "/api/epics/{id}", "REGISTERED", ["PM", "LEAD"], "MEMBER"), p(19, "DELETE", "/api/epics/{id}", "REGISTERED", ["PM", "LEAD"], "MEMBER"),
  p(20, "GET", "/api/projects/{id}/tasks", "REGISTERED", [], "MEMBER"), p(21, "POST", "/api/projects/{id}/tasks", "REGISTERED", ["PM", "LEAD"], "MEMBER"), p(22, "GET", "/api/tasks/{id}", "REGISTERED", [], "MEMBER"), p(23, "PATCH", "/api/tasks/{id}", "REGISTERED", ["PM", "LEAD"], "MEMBER"), p(24, "POST", "/api/tasks/{id}/status", "REGISTERED", ["LEAD", "DEV"], "MEMBER_OR_ASSIGNEE"), p(25, "DELETE", "/api/tasks/{id}", "REGISTERED", ["PM", "LEAD"], "MEMBER"), p(26, "GET", "/api/tasks/{id}/events", "REGISTERED", [], "MEMBER"),
  p(27, "GET", "/api/projects/{id}/sprints", "REGISTERED", [], "MEMBER"), p(28, "POST", "/api/projects/{id}/sprints", "REGISTERED", ["LEAD"], "MEMBER"), p(29, "PATCH", "/api/sprints/{id}", "REGISTERED", ["LEAD"], "MEMBER"), p(30, "POST", "/api/sprints/{id}/start", "REGISTERED", ["LEAD"], "MEMBER"), p(31, "POST", "/api/sprints/{id}/close", "REGISTERED", ["LEAD"], "MEMBER"), p(32, "DELETE", "/api/sprints/{id}", "REGISTERED", ["LEAD"], "MEMBER"), p(33, "GET", "/api/projects/{id}/progress", "REGISTERED", [], "MEMBER"),
  p(34, "POST", "/api/pm/projects/{id}/plans", "REGISTERED", ["PM"], "MEMBER"), p(35, "GET", "/api/pm/proposals/{proposalId}", "REGISTERED", ["PM"], "MEMBER"), p(36, "GET", "/api/pm/projects/{id}/proposals", "REGISTERED", ["PM"], "MEMBER"), p(37, "POST", "/api/pm/proposals/{proposalId}/epics/{index}/expand", "REGISTERED", ["PM"], "MEMBER"), p(38, "PATCH", "/api/pm/proposals/{proposalId}/epics/{index}", "REGISTERED", ["PM"], "MEMBER"), p(39, "POST", "/api/pm/proposals/{proposalId}/epics/{index}/regenerate", "REGISTERED", ["PM"], "MEMBER"), p(40, "POST", "/api/pm/proposals/{proposalId}/approve", "REGISTERED", ["PM"], "MEMBER"), p(41, "POST", "/api/pm/proposals/{proposalId}/reject", "REGISTERED", ["PM"], "MEMBER"),
  p(42, "GET", "/api/lead/projects/{id}/facts", "REGISTERED", ["LEAD"], "MEMBER"), p(43, "GET", "/api/lead/overview", "REGISTERED", ["LEAD"], "MEMBER_PROJECTS"), p(44, "POST", "/api/lead/projects/{id}/digests", "REGISTERED", ["LEAD"], "MEMBER"), p(45, "GET", "/api/lead/projects/{id}/digests/latest", "REGISTERED", ["LEAD"], "MEMBER"), p(46, "GET", "/api/lead/projects/{id}/proposals", "REGISTERED", ["LEAD"], "MEMBER"), p(47, "POST", "/api/lead/proposals/{proposalId}/approve", "REGISTERED", ["LEAD"], "MEMBER"), p(48, "POST", "/api/lead/proposals/{proposalId}/reject", "REGISTERED", ["LEAD"], "MEMBER"),
  p(49, "POST", "/api/dev/projects/{id}/uploads", "REGISTERED", ["DEV"], "MEMBER"), p(50, "POST", "/api/dev/projects/{id}/summaries", "REGISTERED", ["DEV"], "MEMBER"), p(51, "POST", "/api/dev/projects/{id}/standups", "REGISTERED", ["DEV"], "MEMBER"), p(52, "GET", "/api/dev/projects/{id}/standups/mine", "REGISTERED", ["DEV"], "SELF"), p(53, "PATCH", "/api/dev/standups/{standupId}", "REGISTERED", ["DEV"], "SELF"), p(54, "POST", "/api/dev/standups/{standupId}/feedback", "REGISTERED", ["DEV"], "SELF"), p(55, "GET", "/api/lead/projects/{id}/standups", "REGISTERED", ["LEAD"], "MEMBER"),
  p(56, "GET", "/api/usage/sessions", "REGISTERED", [], "SELF"), p(57, "GET", "/api/usage/summary", "REGISTERED"),
];

export function getPolicyMap(): PolicyEntry[] { return POLICY_MAP.map((entry) => ({ ...entry, roles: [...entry.roles] })); }
