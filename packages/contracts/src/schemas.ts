import { z } from "zod";
import { ExpansionStatusSchema, FeatureSchema, ProjectStatusSchema, ProposalStatusSchema, SprintStatusSchema, TaskEventTypeSchema, TaskStatusSchema, UsageOutcomeSchema, UserRoleSchema } from "./enums.js";

const uuid = z.string().uuid();
const instant = z.string().datetime({ offset: true });
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const optionalText = (max: number) => z.string().max(max).nullable().optional();

export const UserSchema = z.object({ id: uuid, email: z.string().email(), displayName: z.string().min(1).max(100), role: UserRoleSchema }).strict();
export const UserInputSchema = z.object({ displayName: z.string().min(1).max(100), role: UserRoleSchema, code: z.string().min(1).optional() }).strict();
export const ProjectSchema = z.object({ id: uuid, name: z.string().min(1).max(200), brief: optionalText(4000), status: ProjectStatusSchema, createdBy: uuid, createdAt: instant, updatedAt: instant, version: z.number().int().positive() }).strict();
export const ProjectInputSchema = z.object({ name: z.string().min(1).max(200), brief: optionalText(4000) }).strict();
export const ProjectDetailSchema = ProjectSchema.extend({ progress: z.object({ pointsTotal: z.number().nonnegative(), pointsDone: z.number().nonnegative(), percent: z.number().min(0).max(100), unestimatedTasks: z.number().int().nonnegative() }).strict() }).strict();
export const MemberSchema = z.object({ userId: uuid, displayName: z.string().min(1).max(100), role: UserRoleSchema, addedAt: instant }).strict();
export const CheckpointSchema = z.object({ id: uuid, projectId: uuid, name: z.string().min(1).max(200), targetDate: date, createdAt: instant, updatedAt: instant, version: z.number().int().positive() }).strict();
export const EpicSchema = z.object({ id: uuid, projectId: uuid, checkpointId: uuid.nullable(), title: z.string().min(1).max(200), description: optionalText(4000), position: z.number().int().nonnegative(), taskCount: z.number().int().nonnegative(), pointsTotal: z.number().nonnegative(), createdAt: instant, updatedAt: instant, version: z.number().int().positive() }).strict();
export const TaskSchema = z.object({
  id: uuid, projectId: uuid, epicId: uuid, sprintId: uuid.nullable(), assigneeId: uuid.nullable(), title: z.string().min(1).max(200), description: optionalText(4000),
  acceptanceCriteria: z.array(z.string().max(300)).max(12), status: TaskStatusSchema, blocked: z.boolean(), blockedReason: optionalText(500), storyPoints: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(5), z.literal(8), z.literal(13)]).nullable(), doneAt: instant.nullable(), createdAt: instant, updatedAt: instant, version: z.number().int().positive(),
}).strict();
export const SprintSchema = z.object({ id: uuid, projectId: uuid, name: z.string().min(1).max(200), startDate: date, endDate: date, status: SprintStatusSchema, completedPoints: z.number().nonnegative().nullable(), version: z.number().int().positive() }).strict();
export const TaskEventSchema = z.object({ id: uuid, taskId: uuid, actorId: uuid, type: TaskEventTypeSchema, from: z.string().nullable(), to: z.string().nullable(), at: instant }).strict();

export const ActivityItemInputSchema = z.object({ type: z.enum(["COMMIT", "PR"]), repo: optionalText(200), externalId: z.string().min(1).max(200), title: z.string().min(1).max(300), body: optionalText(2000), timestamp: instant, url: z.string().url().startsWith("https:").max(500).nullable().optional(), files: z.array(z.string().max(300)).max(50) }).strict();
export const StandupContentSchema = z.object({ yesterday: z.array(z.string().max(300)).max(12), today: z.array(z.string().max(300)).max(12), blockers: z.array(z.string().max(300)).max(12) }).strict();
export const FeatureSchemaRef = FeatureSchema;

const storyPoints = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(5), z.literal(8), z.literal(13)]).nullable();
const planTask = z.object({ title: z.string().min(1).max(200), description: z.string().max(4000), acceptanceCriteria: z.array(z.string().max(300)).max(12), storyPoints }).strict();
export const PlanEpicSchema = z.object({
  index: z.number().int().nonnegative(), title: z.string().min(1).max(200), description: z.string().max(4000), checkpointName: z.string().max(200).nullable(),
  contentHash: z.string().min(1), expansion: z.object({ status: ExpansionStatusSchema, tasks: z.array(planTask).nullable(), error: z.string().nullable() }).strict(),
}).strict();
export const PlanProposalSchema = z.object({
  id: uuid, projectId: uuid, kind: z.literal("PLAN"), status: ProposalStatusSchema, approach: z.string(),
  checkpoints: z.array(z.object({ name: z.string().min(1).max(200), targetDate: date }).strict()), epics: z.array(PlanEpicSchema),
  retrieved: z.array(z.object({ source: z.string().min(1), projectId: uuid, projectName: z.string().min(1), id: uuid, title: z.string().min(1) }).strict()),
  flagged: z.boolean(), createdBy: uuid, createdAt: instant, updatedAt: instant, version: z.number().int().positive(),
}).strict();
export const SuggestionSchema = z.discriminatedUnion("type", [
  z.object({ id: uuid, type: z.literal("MOVE_CHECKPOINT_DATE"), checkpointId: uuid, newTargetDate: date, rationale: z.string().max(300) }).strict(),
  z.object({ id: uuid, type: z.literal("MOVE_EPIC_TO_CHECKPOINT"), epicId: uuid, checkpointId: uuid.nullable(), rationale: z.string().max(300) }).strict(),
  z.object({ id: uuid, type: z.literal("REASSIGN_TASK"), taskId: uuid, assigneeId: uuid, rationale: z.string().max(300) }).strict(),
]);
export const ReplanProposalSchema = z.object({
  id: uuid, projectId: uuid, kind: z.literal("REPLAN"), status: ProposalStatusSchema, suggestions: z.array(SuggestionSchema), explanation: z.string(), flagged: z.boolean(), createdAt: instant, version: z.number().int().positive(),
}).strict();
export const FactsSchema = z.object({
  asOf: instant, pointsTotal: z.number().nonnegative(), pointsDone: z.number().nonnegative(), pointsRemaining: z.number().nonnegative(), unestimatedTasks: z.number().int().nonnegative(),
  velocity: z.array(z.object({ sprintId: uuid, name: z.string().min(1), completedPoints: z.number().nonnegative() }).strict()), avgVelocity: z.number().nonnegative().nullable(), projectedCompletionDate: date.nullable(),
  checkpoints: z.array(z.object({ id: uuid, name: z.string().min(1), targetDate: date, remainingPoints: z.number().nonnegative(), projectedDate: date.nullable(), risk: z.enum(["ON_TRACK", "AT_RISK", "UNKNOWN"]) }).strict()),
  overload: z.array(z.object({ userId: uuid, displayName: z.string().min(1).max(100), openPoints: z.number().nonnegative(), avgCompletedPerSprint: z.number().nonnegative().nullable(), projects: z.array(z.object({ projectId: uuid, name: z.string().min(1), openPoints: z.number().nonnegative() }).strict()) }).strict()),
}).strict();
export const DigestSchema = z.object({ id: uuid, projectId: uuid, facts: FactsSchema, explanation: z.string().nullable(), degraded: z.boolean(), flagged: z.boolean(), proposalId: uuid.nullable(), cached: z.boolean(), createdAt: instant }).strict();
export const StandupSchema = z.object({ id: uuid, projectId: uuid, developerId: uuid, date, content: StandupContentSchema, degraded: z.boolean(), flagged: z.boolean(), cached: z.boolean(), outcome: z.enum(["ACCEPTED", "EDITED"]).nullable(), feedback: z.enum(["UP", "DOWN"]).nullable(), createdAt: instant, updatedAt: instant, version: z.number().int().positive() }).strict();
export const UsageSessionSchema = z.object({ id: uuid, feature: FeatureSchema, startedAt: instant, endedAt: instant.nullable(), outcome: UsageOutcomeSchema, regenerateCount: z.number().int().nonnegative(), feedback: z.string().nullable(), calls: z.number().int().nonnegative(), promptTokens: z.number().int().nonnegative(), completionTokens: z.number().int().nonnegative(), costMicroUsd: z.number().int().nonnegative(), elapsedSeconds: z.number().nonnegative().nullable() }).strict();
export const ProgressSchema = z.object({ pointsTotal: z.number().nonnegative(), pointsDone: z.number().nonnegative(), percent: z.number().min(0).max(100), unestimatedTasks: z.number().int().nonnegative(), velocity: z.array(z.object({ sprintId: uuid, name: z.string().min(1), completedPoints: z.number().nonnegative() }).strict()) }).strict();
export const UploadResponseSchema = z.object({ received: z.number().int().nonnegative(), created: z.number().int().nonnegative(), updated: z.number().int().nonnegative(), unchanged: z.number().int().nonnegative(), rejected: z.array(z.object({ index: z.number().int().nonnegative(), reason: z.string().min(1) }).strict()), needsSummary: z.array(uuid) }).strict();
export const SummaryResponseSchema = z.object({ summaries: z.array(z.object({ itemId: uuid, oneLiner: z.string().min(1), cached: z.boolean() }).strict()), failed: z.array(uuid) }).strict();
export const PlanApprovalSchema = z.object({ proposalId: uuid, status: z.literal("APPROVED"), created: z.object({ checkpoints: z.array(CheckpointSchema), epics: z.array(EpicSchema), tasks: z.array(TaskSchema) }).strict() }).strict();
export const ReplanApprovalSchema = z.object({ proposalId: uuid, status: z.literal("APPROVED"), applied: z.array(uuid) }).strict();
export const LeadOverviewSchema = z.array(z.object({ project: ProjectSchema, facts: FactsSchema.pick({ pointsTotal: true, pointsDone: true, pointsRemaining: true, projectedCompletionDate: true }).strict(), latestDigest: z.object({ status: z.enum(["AVAILABLE", "NONE"]) }).strict() }).strict());
export const UsageSummarySchema = z.array(z.object({ feature: FeatureSchema, model: z.string().min(1), calls: z.number().int().nonnegative(), promptTokens: z.number().int().nonnegative(), completionTokens: z.number().int().nonnegative(), costMicroUsd: z.number().int().nonnegative(), cacheHits: z.number().int().nonnegative(), avgLatencyMs: z.number().nonnegative(), schemaFailures: z.number().int().nonnegative(), estimateErrorPercent: z.number().nonnegative() }).strict());

export type User = z.infer<typeof UserSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type Task = z.infer<typeof TaskSchema>;
export type PlanProposal = z.infer<typeof PlanProposalSchema>;
export type ReplanProposal = z.infer<typeof ReplanProposalSchema>;
export type Facts = z.infer<typeof FactsSchema>;
export type Digest = z.infer<typeof DigestSchema>;
export type Standup = z.infer<typeof StandupSchema>;
export type UsageSession = z.infer<typeof UsageSessionSchema>;
export type Progress = z.infer<typeof ProgressSchema>;
export type UploadResponse = z.infer<typeof UploadResponseSchema>;
export type SummaryResponse = z.infer<typeof SummaryResponseSchema>;
export type PlanApproval = z.infer<typeof PlanApprovalSchema>;
export type ReplanApproval = z.infer<typeof ReplanApprovalSchema>;
export type LeadOverview = z.infer<typeof LeadOverviewSchema>;
export type UsageSummary = z.infer<typeof UsageSummarySchema>;
