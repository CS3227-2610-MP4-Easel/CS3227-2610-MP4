import { z } from "zod/v3";
const uuid = z.string().uuid();
const suggestion = z.discriminatedUnion("type", [
  z.object({ id: uuid, type: z.literal("MOVE_CHECKPOINT_DATE"), checkpointId: uuid, newTargetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), rationale: z.string().max(300) }).strict(),
  z.object({ id: uuid, type: z.literal("MOVE_EPIC_TO_CHECKPOINT"), epicId: uuid, checkpointId: uuid.nullable(), rationale: z.string().max(300) }).strict(),
  z.object({ id: uuid, type: z.literal("REASSIGN_TASK"), taskId: uuid, assigneeId: uuid, rationale: z.string().max(300) }).strict(),
]);
export const DigestOutputSchema = z.object({ explanation: z.string().max(4000), suggestions: z.array(suggestion).max(50) }).strict();
export type DigestOutput = z.infer<typeof DigestOutputSchema>;
