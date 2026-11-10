import { StoryPointsSchema } from "@agile/contracts";
import { z, type ZodTypeAny } from "zod/v3";


const DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS_AHEAD = 730;

/** True for a real calendar date written YYYY-MM-DD ("2026-02-30" is not one). */
function isRealDate(value: string): boolean {
  if (!DATE_SHAPE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** `date` (a real YYYY-MM-DD) plus `days`, as YYYY-MM-DD; calendar arithmetic in UTC, so no time zone can shift it. */
export function addDaysIso(date: string, days: number): string {
  if (!isRealDate(date)) throw new Error("INVALID_DATE");
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** `today` is YYYY-MM-DD in Asia/Singapore. ISO dates compare correctly as strings. */
export function outlineOutputSchema(today: string): ZodTypeAny {
  const latest = addDaysIso(today, MAX_DAYS_AHEAD);
  const checkpoint = z.object({
    name: z.string().min(1).max(200),
    targetDate: z.string().refine((value) => isRealDate(value) && value >= today && value <= latest),
  });
  const epic = z.object({
    title: z.string().min(1).max(200),
    description: z.string().min(1).max(1000),
    checkpointName: z.string().nullable(),
  });
  return z.object({
    approach: z.string().min(1).max(1500),
    checkpoints: z.array(checkpoint).max(8),
    epics: z.array(epic).min(1).max(10),
  }).superRefine((value, ctx) => {
    const names = value.checkpoints.map((c) => c.name);
    if (new Set(names.map((n) => n.toLowerCase())).size !== names.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "duplicate checkpoint name" });
    value.epics.forEach((e, index) => {
      if (e.checkpointName !== null && !names.includes(e.checkpointName)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["epics", index, "checkpointName"], message: "unknown checkpoint" });
    });
  });
}



export const expandOutputSchema: ZodTypeAny = z.object({
  tasks: z.array(z.object({
    title: z.string().min(1).max(200),
    description: z.string().min(1).max(1000),
    acceptanceCriteria: z.array(z.string().min(1).max(300)).min(1).max(6),
    storyPoints: StoryPointsSchema,
  })).min(1).max(8),
});
