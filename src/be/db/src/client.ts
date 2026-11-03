import { PrismaClient, type Prisma } from "@prisma/client";
import { applyVisibilityToArgs, isVisibleUniqueResult, normalizeUniqueSelector, sanitizeVisibleResult } from "./visibility.js";
const modelNames = new Map([
  ["user", "User"], ["project", "Project"], ["projectMember", "ProjectMember"], ["checkpoint", "Checkpoint"], ["epic", "Epic"], ["sprint", "Sprint"], ["task", "Task"], ["taskEvent", "TaskEvent"], ["aiProposal", "AiProposal"], ["proposalEpic", "ProposalEpic"], ["aiSession", "AiSession"], ["llmCall", "LlmCall"], ["activityItem", "ActivityItem"], ["itemSummary", "ItemSummary"], ["standup", "Standup"], ["projectDigest", "ProjectDigest"],
]);

export function applyDefaultReadFilter(model: string, args: Record<string, unknown>) { return applyVisibilityToArgs(model, args); }

export function canUseMaintenanceCapability(): false { return false; }

type RawSqlMethodName = "$queryRaw" | "$queryRawUnsafe" | "$executeRaw" | "$executeRawUnsafe" | "$extends";
export type FilteredDbClient = Omit<PrismaClient, RawSqlMethodName>;
const RAW_SQL_METHODS = new Set<RawSqlMethodName>(["$queryRaw", "$queryRawUnsafe", "$executeRaw", "$executeRawUnsafe", "$extends"]);
type ReadQuery = { model: string; args: Record<string, unknown>; query: (args: Record<string, unknown>) => Promise<unknown> };
const filteredReadExtension = {
  query: {
    $allModels: {
      async findMany({ model, args, query }: ReadQuery) { return sanitizeVisibleResult(model, await query(applyDefaultReadFilter(model, args)), args); },
      async findFirst({ model, args, query }: ReadQuery) { return sanitizeVisibleResult(model, await query(applyDefaultReadFilter(model, args)), args); },
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
        const result = sanitizeVisibleResult(model, await query(applyDefaultReadFilter(model, args)), args);
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

function hideRawSql<T extends object>(client: T): Omit<T, RawSqlMethodName> {
  return new Proxy(client, {
    get(target, property, receiver) {
      if (typeof property === "string" && RAW_SQL_METHODS.has(property as RawSqlMethodName)) return undefined;
      if (property === "$transaction") {
        const transaction = Reflect.get(target, property, receiver) as (...args: any[]) => unknown;
        return (input: unknown, ...options: unknown[]) => typeof input === "function"
          ? transaction.call(target, (tx: object) => input(wrapUniqueReads(hideRawSql(tx))), ...options)
          : transaction.call(target, input, ...options);
      }
      return Reflect.get(target, property, receiver);
    },
  }) as Omit<T, RawSqlMethodName>;
}

export function createDbClient(base: PrismaClient = new PrismaClient()): FilteredDbClient {
  const filtered = base.$extends(filteredReadExtension) as unknown as PrismaClient;
  return wrapUniqueReads(hideRawSql(filtered));
}
export type ReadArgs = Prisma.TaskFindManyArgs;
