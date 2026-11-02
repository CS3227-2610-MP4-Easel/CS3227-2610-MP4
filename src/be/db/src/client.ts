import { PrismaClient, type Prisma } from "@prisma/client";
import { applyVisibilityToArgs, isVisibleUniqueResult, normalizeUniqueSelector, sanitizeVisibleResult } from "./visibility.js";
const modelNames = new Map([
  ["user", "User"], ["project", "Project"], ["projectMember", "ProjectMember"], ["checkpoint", "Checkpoint"], ["epic", "Epic"], ["sprint", "Sprint"], ["task", "Task"], ["taskEvent", "TaskEvent"], ["aiProposal", "AiProposal"], ["proposalEpic", "ProposalEpic"], ["aiSession", "AiSession"], ["llmCall", "LlmCall"], ["activityItem", "ActivityItem"], ["itemSummary", "ItemSummary"], ["standup", "Standup"], ["projectDigest", "ProjectDigest"],
]);

export function applyDefaultReadFilter(model: string, args: Record<string, unknown>) { return applyVisibilityToArgs(model, args); }

export function canUseMaintenanceCapability(): false { return false; }

export type FilteredDbClient = PrismaClient;
type ReadQuery = { model: string; args: Record<string, unknown>; query: (args: Record<string, unknown>) => Promise<unknown> };
const filteredReadExtension = {
  query: {
    $allModels: {
      async findMany({ model, args, query }: ReadQuery) { return sanitizeVisibleResult(model, await query(applyDefaultReadFilter(model, args))); },
      async findFirst({ model, args, query }: ReadQuery) { return sanitizeVisibleResult(model, await query(applyDefaultReadFilter(model, args))); },
      async count({ model, args, query }: ReadQuery) { return query(applyDefaultReadFilter(model, args)); },
      async aggregate({ model, args, query }: ReadQuery) { return query(applyDefaultReadFilter(model, args)); },
      async groupBy({ model, args, query }: ReadQuery) { return query(applyDefaultReadFilter(model, args)); },
      async findUnique({ model, args, query }: ReadQuery) { return isVisibleUniqueResult(model, await query(args)); },
      async findUniqueOrThrow({ model, args, query }: ReadQuery) {
        const result = isVisibleUniqueResult(model, await query(args));
        if (result === null) throw new Error("NOT_FOUND");
        return result;
      },
      async findFirstOrThrow({ model, args, query }: ReadQuery) {
        const result = sanitizeVisibleResult(model, await query(applyDefaultReadFilter(model, args)));
        if (result === null) throw new Error("NOT_FOUND");
        return result;
      },
    },
  },
};

function wrapUniqueReads<T extends object>(client: T): T {
  return new Proxy(client, {
    get(target, property, receiver) {
      const delegate = Reflect.get(target, property, receiver);
      const model = typeof property === "string" ? modelNames.get(property) : undefined;
      if (!model || !delegate || typeof delegate !== "object") return delegate;
      return new Proxy(delegate, {
        get(modelTarget, operation, modelReceiver) {
          if (operation !== "findUnique" && operation !== "findUniqueOrThrow") return Reflect.get(modelTarget, operation, modelReceiver);
          const findFirst = Reflect.get(modelTarget, operation === "findUnique" ? "findFirst" : "findFirstOrThrow", modelReceiver) as (args: Record<string, unknown>) => Promise<unknown>;
          return (args: Record<string, unknown>) => {
            const where = normalizeUniqueSelector(model, (args.where as Record<string, unknown> | undefined) ?? {});
            return findFirst({ ...args, where });
          };
        },
      });
    },
  });
}

export function createDbClient(base: PrismaClient = new PrismaClient()): FilteredDbClient {
  return wrapUniqueReads(base.$extends(filteredReadExtension) as unknown as FilteredDbClient);
}
export type ReadArgs = Prisma.TaskFindManyArgs;
