import { PrismaClient, type Prisma } from "@prisma/client";

const softDeletable = new Set(["Checkpoint", "Epic", "Sprint", "Task"]);

export function applyDefaultReadFilter(model: string, args: Record<string, unknown>) {
  const where = { ...((args.where as Record<string, unknown> | undefined) ?? {}) };
  if (softDeletable.has(model)) where.deletedAt = null;
  where.project = { ...((where.project as Record<string, unknown> | undefined) ?? {}), status: "ACTIVE" };
  return { ...args, where };
}

export function canUseMaintenanceCapability(): false { return false; }

export type FilteredDbClient = PrismaClient;
export function createDbClient(): FilteredDbClient { return new PrismaClient(); }
export type ReadArgs = Prisma.TaskFindManyArgs;
