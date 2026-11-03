export function buildAtomicVersionUpdate(id: string, version: number) {
  return { where: { id, version }, data: { version: { increment: 1 } } } as const;
}

export function assertSameProject(expectedProjectId: string, actualProjectId: string): void {
  if (expectedProjectId !== actualProjectId) throw new Error("NOT_FOUND");
}

export function assertWritableState(status: "ACTIVE" | "ARCHIVED"): void {
  if (status !== "ACTIVE") throw new Error("CONFLICT_STATE");
}

export async function inCoreTransaction<T>(transaction: { $transaction: <R>(callback: (tx: unknown) => Promise<R>) => Promise<R> }, callback: (tx: unknown) => Promise<T>): Promise<T> {
  return transaction.$transaction(callback);
}

export type MutationTransaction = {
  $transaction: <R>(callback: (tx: unknown) => Promise<R>, options?: { isolationLevel: "RepeatableRead" }) => Promise<R>;
};

/** Callbacks can run up to three times; keep external side effects outside the transaction. */
export async function inMutationTransaction<T>(transaction: MutationTransaction, lockResource: (tx: unknown) => Promise<void>, recheck: (tx: unknown) => Promise<void>, mutate: (tx: unknown) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await transaction.$transaction(async (tx) => {
        await lockResource(tx);
        await recheck(tx);
        return mutate(tx);
      }, { isolationLevel: "RepeatableRead" });
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (attempt >= 2 || (code !== "P2034" && code !== "40001")) throw error;
    }
  }
}
