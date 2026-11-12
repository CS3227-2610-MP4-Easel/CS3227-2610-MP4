import { z } from "zod/v3";

const points = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(5), z.literal(8), z.literal(13)]);

function isRealDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export const PlanInputSchema = z
  .object({
    checkpoints: z.array(z.object({ name: z.string().min(1).max(200), targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).strict()).max(8),
    epics: z
      .array(
        z
          .object({
            title: z.string().min(1).max(200),
            description: z.string().max(4000),
            checkpointName: z.string().max(200).nullable(),
            tasks: z
              .array(
                z
                  .object({
                    title: z.string().min(1).max(200),
                    description: z.string().max(4000),
                    acceptanceCriteria: z.array(z.string().min(1).max(300)).max(12),
                    storyPoints: points,
                  })
                  .strict(),
              )
              .min(1)
              .max(8),
          })
          .strict(),
      )
      .min(1)
      .max(10),
  })
  .strict()
  .superRefine((plan, ctx) => {
    const seen = new Set<string>();
    for (const [index, checkpoint] of plan.checkpoints.entries()) {
      const key = checkpoint.name.toLowerCase();
      if (seen.has(key)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "duplicate checkpoint name", path: ["checkpoints", index, "name"] });
      seen.add(key);
      if (!isRealDate(checkpoint.targetDate)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "not a calendar date", path: ["checkpoints", index, "targetDate"] });
    }
    const names = new Set(plan.checkpoints.map((checkpoint) => checkpoint.name));
    for (const [index, epic] of plan.epics.entries()) {
      if (epic.checkpointName !== null && !names.has(epic.checkpointName)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "unknown checkpoint name", path: ["epics", index, "checkpointName"] });
    }
  });

export type PlanInput = z.infer<typeof PlanInputSchema>;

export function countPlan(plan: PlanInput): { checkpoints: number; epics: number; tasks: number } {
  return {
    checkpoints: plan.checkpoints.length,
    epics: plan.epics.length,
    tasks: plan.epics.reduce((sum, epic) => sum + epic.tasks.length, 0),
  };
}
