import type { PrismaClient } from "@prisma/client";

/** AD-59: one atomic upsert on `rate_counters` using the database clock; starts a new window when now >= window_start + windowSeconds. */
export async function incrementRateCounter(client: PrismaClient, key: string, windowSeconds: number): Promise<{ count: number; remainingSeconds: number }> {
  void client; void key; void windowSeconds;
  throw new Error("NOT_IMPLEMENTED");
}
