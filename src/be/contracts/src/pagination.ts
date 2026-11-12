import { z } from "zod/v3";

export const PageQuerySchema = z.object({
  page: z.coerce.number().int().min(0).max(10_000).default(0),
  size: z.coerce.number().int().min(1).max(100).default(20),
}).strict();
export type PageQuery = z.infer<typeof PageQuerySchema>;

export function pageSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({ items: z.array(item), page: z.number().int().min(0).max(10_000), size: z.number().int().min(1).max(100), total: z.number().int().nonnegative() }).strict();
}
