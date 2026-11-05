import type { PrismaClient } from "@prisma/client";

/** AD-59: one atomic upsert on `rate_counters` using the database clock; starts a new window when now >= window_start + windowSeconds.
 * `window_start` is TIMESTAMP(3) without a time zone holding UTC, so the clock is read as UTC. The row lock taken by ON CONFLICT
 * serialises concurrent calls; SET reads the old row and RETURNING the new one. */
export async function incrementRateCounter(client: PrismaClient, key: string, windowSeconds: number): Promise<{ count: number; remainingSeconds: number }> {
  const rows = await client.$queryRaw<Array<{ count: number; remaining_seconds: number }>>`
    INSERT INTO rate_counters (key, window_start, count) VALUES (${key}, (now() AT TIME ZONE 'UTC'), 1)
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN (now() AT TIME ZONE 'UTC') >= rate_counters.window_start + make_interval(secs => ${windowSeconds}::double precision) THEN 1 ELSE rate_counters.count + 1 END,
      window_start = CASE WHEN (now() AT TIME ZONE 'UTC') >= rate_counters.window_start + make_interval(secs => ${windowSeconds}::double precision) THEN (now() AT TIME ZONE 'UTC') ELSE rate_counters.window_start END
    RETURNING count, CEIL(EXTRACT(EPOCH FROM (window_start + make_interval(secs => ${windowSeconds}::double precision) - (now() AT TIME ZONE 'UTC'))))::int AS remaining_seconds`;
  return { count: rows[0].count, remainingSeconds: rows[0].remaining_seconds };
}
