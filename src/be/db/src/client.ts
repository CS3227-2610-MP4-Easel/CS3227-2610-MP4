import { PrismaClient, Prisma } from "@prisma/client";
import { applyVisibilityToArgs, isVisibleUniqueResult, normalizeUniqueSelector, sanitizeVisibleResult, VISIBILITY_POLICY } from "./visibility.js";
const modelNames = new Map(Prisma.dmmf.datamodel.models.map(({ name }) => [name[0].toLowerCase() + name.slice(1), name]));

export function applyDefaultReadFilter(model: string, args: Record<string, unknown>) { return applyVisibilityToArgs(model, args); }

export function canUseMaintenanceCapability(): false { return false; }

type RawSqlMethodName = "$queryRaw" | "$queryRawUnsafe" | "$executeRaw" | "$executeRawUnsafe" | "$extends";
export type FilteredTransactionClient = Omit<Prisma.TransactionClient, RawSqlMethodName>;
export type FilteredDbClient = Omit<PrismaClient, RawSqlMethodName | "$transaction"> & {
  $transaction: {
    <P extends Prisma.PrismaPromise<unknown>[]>(arg: [...P], options?: { isolationLevel?: Prisma.TransactionIsolationLevel }): Promise<unknown[]>;
    <R>(callback: (tx: FilteredTransactionClient) => Promise<R>, options?: { maxWait?: number; timeout?: number; isolationLevel?: Prisma.TransactionIsolationLevel }): Promise<R>;
  };
};
const RAW_SQL_METHODS = new Set<RawSqlMethodName>(["$queryRaw", "$queryRawUnsafe", "$executeRaw", "$executeRawUnsafe", "$extends"]);
type ReadQuery = { model: string; args: Record<string, unknown>; query: (args: Record<string, unknown>) => Promise<unknown> };
async function visibleWrite({ model, args, query }: ReadQuery, filterTarget: boolean): Promise<unknown> {
  const transformed = applyDefaultReadFilter(model, args);
  if (!filterTarget) delete transformed.where;
  return sanitizeVisibleResult(model, await query(transformed), args);
}

const filteredReadExtension = {
  query: {
    $allModels: {
      async create(query: ReadQuery) { return visibleWrite(query, false); },
      async update(query: ReadQuery) { return visibleWrite(query, true); },
      async upsert(query: ReadQuery) { return visibleWrite(query, true); },
      async delete(query: ReadQuery) { return visibleWrite(query, true); },
      async updateMany({ model, args, query }: ReadQuery) { return query(applyDefaultReadFilter(model, args)); },
      async deleteMany({ model, args, query }: ReadQuery) { return query(applyDefaultReadFilter(model, args)); },
      async createManyAndReturn(query: ReadQuery) { return visibleWrite(query, false); },
      async updateManyAndReturn(query: ReadQuery) { return visibleWrite(query, true); },
      async createMany({ model, args, query }: ReadQuery) { applyDefaultReadFilter(model, {}); return query(args); },
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
      if (!VISIBILITY_POLICY[model]) throw new Error(`Missing visibility policy for ${model}`);
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

/** Callers must authorize all nested writes and relation connections in the mutation transaction;
 * visibility filters protect top-level targets and returned relations, not nested mutation inputs. */
export function createDbClient(base: PrismaClient = new PrismaClient()): FilteredDbClient {
  const filtered = base.$extends(filteredReadExtension) as unknown as PrismaClient;
  return wrapUniqueReads(hideRawSql(filtered)) as unknown as FilteredDbClient;
}
export type ReadArgs = Prisma.TaskFindManyArgs;
