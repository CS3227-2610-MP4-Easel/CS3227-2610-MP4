import { z } from "zod/v3";

const line = z.string().min(1).max(300).refine((s) => !/[\r\n\u{2028}\u{2029}]/u.test(s));
export const SummaryOutputSchema = z.object({ items: z.array(z.object({ n: z.number().int(), oneLiner: line }).strict()).max(10) }).strict();
export const StandupOutputSchema = z.object({ yesterday: z.array(line).max(12), today: z.array(line).max(12), blockers: z.array(line).max(12) }).strict();
