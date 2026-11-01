import { z } from "zod";

export const UserRoleSchema = z.enum(["PM", "DEV_LEAD", "DEVELOPER"]);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const FeatureSchema = z.enum([
  "PM_PLAN_OUTLINE",
  "PM_PLAN_EXPAND",
  "LEAD_DIGEST",
  "DEV_SUMMARY",
  "DEV_STANDUP",
]);
export type Feature = z.infer<typeof FeatureSchema>;

export const ProjectStatusSchema = z.enum(["ACTIVE", "ARCHIVED"]);
export const TaskStatusSchema = z.enum(["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"]);
export const SprintStatusSchema = z.enum(["PLANNED", "ACTIVE", "CLOSED"]);
export const ProposalStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED", "SUPERSEDED"]);
export const ExpansionStatusSchema = z.enum(["PENDING", "IN_PROGRESS", "DONE", "FAILED"]);
export const UsageOutcomeSchema = z.enum(["OPEN", "ACCEPTED", "EDITED", "REJECTED", "ABANDONED"]);
export const TaskEventTypeSchema = z.enum([
  "CREATED", "STATUS_CHANGED", "ASSIGNEE_CHANGED", "BLOCKED", "UNBLOCKED", "POINTS_CHANGED", "SPRINT_CHANGED",
]);

export const RoleAliasSchema = z.enum(["PM", "LEAD", "DEV", "DEV_LEAD", "DEVELOPER"]);
export const AuthStateSchema = z.enum(["PUBLIC", "TOKEN", "REGISTERED"]);
export const PredicateSchema = z.enum([
  "NONE", "MEMBER", "SELF", "ASSIGNEE", "ADDER", "MEMBER_OR_ASSIGNEE", "MEMBER_PROJECTS",
]);
