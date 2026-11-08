export type TaskEventInput = { taskId: string; projectId: string; actorId: string; type: "CREATED" | "STATUS_CHANGED" | "ASSIGNEE_CHANGED" | "BLOCKED" | "UNBLOCKED" | "POINTS_CHANGED" | "SPRINT_CHANGED"; fromValue?: string | null; toValue?: string | null };

/** Kept separate so every task mutation uses the same transaction-bound event write. */
export async function writeTaskEvent(tx: { taskEvent: { create(args: { data: TaskEventInput }): Promise<unknown> } }, event: TaskEventInput): Promise<void> {
  await tx.taskEvent.create({ data: { ...event, fromValue: event.fromValue ?? null, toValue: event.toValue ?? null } });
}
