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

export async function inMutationTransaction<T>(transaction: MutationTransaction, lockResource: (tx: unknown) => Promise<void>, recheck: (tx: unknown) => Promise<void>, mutate: (tx: unknown) => Promise<T>): Promise<T> {
  return transaction.$transaction(async (tx) => {
    await lockResource(tx);
    await recheck(tx);
    return mutate(tx);
  }, { isolationLevel: "RepeatableRead" });
}
