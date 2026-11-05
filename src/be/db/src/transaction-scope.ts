import { AsyncLocalStorage } from "node:async_hooks";

// Set while code runs inside a transaction this package started, so the LLM gateway can refuse a model call there.
// Only `isInTransaction` is exported from the package; the scope is entered by this package's helpers alone.
const transactionScope = new AsyncLocalStorage<true>();

export function runInTransactionScope<T>(fn: () => T): T {
  return transactionScope.run(true, fn);
}

/** True inside `inCoreTransaction`, `inMutationTransaction` and the filtered client's callback `$transaction`. */
export function isInTransaction(): boolean {
  return transactionScope.getStore() === true;
}
