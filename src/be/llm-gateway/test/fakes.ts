import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import type { Clock } from "../src/index.js";

export const integrationUrl = process.env.W1_INTEGRATION_DATABASE_URL;

/** A clock whose `sleep` moves time forward instantly, so time rules are tested without waiting. */
export function fakeClock(start = "2026-11-05T02:00:00.000Z"): Clock & { advance(ms: number): void; set(iso: string): void } {
  let now = new Date(start).getTime();
  return {
    now: () => new Date(now),
    sleep: async (ms) => { now += ms; },
    advance: (ms) => { now += ms; },
    set: (iso) => { now = new Date(iso).getTime(); },
  };
}

/** A real client for integration tests, with users created under a random tag and deleted afterwards (gateway rows first). */
export async function withIntegrationDb(run: (base: PrismaClient, fixtures: { user(): Promise<string> }) => Promise<void>): Promise<void> {
  const base = new PrismaClient({ adapter: new PrismaPg({ connectionString: integrationUrl }) });
  const tag = randomUUID();
  const userIds: string[] = [];
  const user = async () => {
    const created = await base.user.create({ data: { firebaseUid: `${tag}-${randomUUID()}`, email: `${randomUUID()}@${tag}.test`, displayName: "Gateway test", role: "DEVELOPER" } });
    userIds.push(created.id);
    return created.id;
  };
  try {
    await run(base, { user });
  } finally {
    await base.llmCall.deleteMany({ where: { userId: { in: userIds } } });
    await base.aiSession.deleteMany({ where: { userId: { in: userIds } } });
    await base.user.deleteMany({ where: { id: { in: userIds } } });
    await base.$disconnect();
  }
}
