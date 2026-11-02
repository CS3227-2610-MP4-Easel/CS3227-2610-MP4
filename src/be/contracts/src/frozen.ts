import { z } from "zod";
import { FeatureSchema, UserRoleSchema } from "./enums.js";
import { NotMember } from "./errors.js";

const uuid = z.string().uuid();

export const ContextSectionSchema = z.object({ name: z.string().min(1), kind: z.enum(["STATIC", "RETRIEVED", "DYNAMIC"]), priority: z.number().int(), budgetTokens: z.number().int().positive(), text: z.string(), trusted: z.boolean() }).strict();
export const LlmCallSchema = z.object({
  feature: FeatureSchema, caller: z.object({ userId: uuid, role: UserRoleSchema }).strict(), sessionId: uuid, projectId: uuid.nullable(), sections: z.array(ContextSectionSchema),
  output: z.union([z.object({ kind: z.literal("json"), schema: z.unknown() }).strict(), z.object({ kind: z.literal("text"), maxChars: z.number().int().positive() }).strict()]), inputHash: z.string().min(1),
}).strict();
export const LlmResultSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), value: z.unknown(), callId: uuid, flagged: z.boolean(), truncated: z.boolean(), cacheHit: z.boolean(), promptTokens: z.number().int().nonnegative(), completionTokens: z.number().int().nonnegative(), costMicroUsd: z.number().int().nonnegative() }).strict(),
  z.object({ ok: z.literal(false), code: z.enum(["AI_BUSY", "AI_UNAVAILABLE", "AI_DISABLED", "REQUEST_REFUSED", "BLOCKED_INPUT", "ROLE_DENIED"]), retryAfterSeconds: z.number().int().positive().optional(), callId: uuid.optional() }).strict(),
]);

export type ContextSections = z.infer<typeof ContextSectionSchema>[];
export type LlmCall = z.infer<typeof LlmCallSchema>;
export type LlmResult = z.infer<typeof LlmResultSchema>;
export type LlmGateway = { run(call: LlmCall): Promise<LlmResult> };
export type AiContext = { assemble(caller: { userId: string; role: z.infer<typeof UserRoleSchema> }, feature: z.infer<typeof FeatureSchema>, targetProjectId: string): Promise<ContextSections> };
export type Sessions = { open(input: { feature: z.infer<typeof FeatureSchema>; userId: string; projectId: string | null }): Promise<string>; assertUsable(sessionId: string, userId: string, feature: z.infer<typeof FeatureSchema>): Promise<void>; touch(sessionId: string): Promise<void>; close(sessionId: string, outcome: string, actorId: string): Promise<void> };
export const SESSION_CAPS = { maxRegenerations: 5, maxNewSessionsPerUserPerDay: 20, maxOpenSessionsPerFeature: 3 } as const;
export type Core = { requireMember(userId: string, projectId: string): Promise<void>; assertWritable(projectId: string): Promise<void>; progress(projectId: string): Promise<{ pointsTotal: number; pointsDone: number; percent: number; unestimatedTasks: number }>; velocity(projectId: string, n: number): Promise<unknown[]>; applyPlan(tx: unknown, projectId: string, plan: unknown, actorId: string): Promise<void>; applyReplan(tx: unknown, projectId: string, suggestions: unknown, actorId: string): Promise<void> };

export { NotMember };
