import assert from "node:assert/strict";
import { test } from "node:test";
import { applyDefaultReadFilter, canUseMaintenanceCapability, createDbClient } from "../src/client.js";

test("F5/E10 request-facing reads exclude deleted and archived rows", () => {
  assert.deepEqual(applyDefaultReadFilter("Task", { where: { status: "TODO" } }), { where: { status: "TODO", deletedAt: null, project: { status: "ACTIVE" } } });
});

test("F5/E10 nullable project reads cannot escape the active-project predicate through OR", () => {
  assert.deepEqual(applyDefaultReadFilter("AiSession", { where: { OR: [{ outcome: "OPEN" }] } }), {
    where: {
      AND: [
        { OR: [{ outcome: "OPEN" }] },
        { OR: [{ projectId: null }, { project: { status: "ACTIVE" } }] },
      ],
    },
  });
});

test("E19 request-facing client has no maintenance opt-out", () => {
  assert.equal(canUseMaintenanceCapability(), false);
});

test("F5/E10 createDbClient applies the default filter through the Prisma read extension", async () => {
  let received: Record<string, unknown> | undefined;
  let uniqueReceived: Record<string, unknown> | undefined;
  const fakePrisma = {
    $extends(extension: any) {
      return {
        task: {
          findMany: (args: Record<string, unknown>) => extension.query.$allModels.findMany({
            model: "Task",
            args,
            query: async (filtered: Record<string, unknown>) => { received = filtered; return []; },
          }),
          findFirst: (args: Record<string, unknown>) => extension.query.$allModels.findFirst({
            model: "Task",
            args,
            query: async (original: Record<string, unknown>) => { uniqueReceived = original; return null; },
          }),
        },
      };
    },
  };
  const client = createDbClient(fakePrisma as never) as unknown as { task: { findMany(args: Record<string, unknown>): Promise<unknown[]> } };
  await client.task.findMany({ where: { status: "TODO" } });
  assert.deepEqual(received, { where: { status: "TODO", deletedAt: null, project: { status: "ACTIVE" } } });
  assert.equal(await client.task.findUnique({ where: { id: "id" } }), null);
  assert.deepEqual(uniqueReceived, { where: { id: "id", deletedAt: null, project: { status: "ACTIVE" } } });
});
