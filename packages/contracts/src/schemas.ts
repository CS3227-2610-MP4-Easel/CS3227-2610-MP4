import { z } from "zod";
import { FeatureSchema, ProjectStatusSchema, SprintStatusSchema, TaskEventTypeSchema, TaskStatusSchema, UserRoleSchema } from "./enums.js";

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

export type User = z.infer<typeof UserSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type Task = z.infer<typeof TaskSchema>;
