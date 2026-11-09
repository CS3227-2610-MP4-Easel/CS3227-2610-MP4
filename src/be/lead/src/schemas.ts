import { z } from "zod/v3";
import { checkOutput } from "@agile/llm-gateway";
const uuid = z.string().uuid();
const safeText = (max: number) => z.string().max(max).refine((value) => checkOutput(value, { kind: "text", maxChars: max }, { boundary: "", secrets: [] }).ok, "UNSAFE_OUTPUT");
const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "INVALID_DATE");
const suggestion = z.discriminatedUnion("type", [
  z.object({ id: uuid, type: z.literal("MOVE_CHECKPOINT_DATE"), checkpointId: uuid, newTargetDate: calendarDate, rationale: safeText(300) }).strict(),
  z.object({ id: uuid, type: z.literal("MOVE_EPIC_TO_CHECKPOINT"), epicId: uuid, checkpointId: uuid.nullable(), rationale: safeText(300) }).strict(),
  z.object({ id: uuid, type: z.literal("REASSIGN_TASK"), taskId: uuid, assigneeId: uuid, rationale: safeText(300) }).strict(),
]);
export const DigestOutputSchema = z.object({ explanation: safeText(4000), suggestions: z.array(suggestion).max(50) }).strict();
export type DigestOutput = z.infer<typeof DigestOutputSchema>;
