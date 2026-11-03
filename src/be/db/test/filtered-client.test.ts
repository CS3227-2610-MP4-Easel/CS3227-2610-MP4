import assert from "node:assert/strict";
import { test } from "node:test";
import { applyDefaultReadFilter, canUseMaintenanceCapability, createDbClient } from "../src/client.js";
import { VISIBILITY_POLICY, normalizeUniqueSelector, sanitizeVisibleResult } from "../src/visibility.js";
import { Prisma } from "@prisma/client";

test("visibility registry covers every relation on request-facing models", () => {
  for (const model of Prisma.dmmf.datamodel.models.filter((model) => VISIBILITY_POLICY[model.name])) {
    const relations = model.fields.filter((field) => field.kind === "object");
    assert.deepEqual(Object.keys(VISIBILITY_POLICY[model.name].relations).sort(), relations.map((field) => field.name).sort(), model.name);
    for (const field of relations) {
      assert.equal(VISIBILITY_POLICY[model.name].relations[field.name], field.type);
      assert.equal(VISIBILITY_POLICY[model.name].cardinality[field.name], field.isList ? "many" : "one");
    }
  }
});

test("nested omit keeps visibility fields for filtering and removes them afterward", () => {
  const args = { include: { epic: { omit: { deletedAt: true } } } };
  const transformed = applyDefaultReadFilter("Task", args) as any;
  assert.equal(transformed.include.epic.omit.deletedAt, false);
  assert.deepEqual(sanitizeVisibleResult("Task", { epic: { title: "hidden", deletedAt: new Date(), project: { status: "ACTIVE" } } }, args), { epic: null });
  assert.deepEqual(sanitizeVisibleResult("Task", { epic: { title: "visible", deletedAt: null, project: { status: "ACTIVE" } } }, args), { epic: { title: "visible" } });
});

test("selected project fields survive visibility checks", () => {
  assert.deepEqual(sanitizeVisibleResult("Project", [{ id: "p" }]), [{ id: "p" }]);
});

test("selected to-one relations include visibility fields and remove them from output", () => {
  const args = { select: { epic: { select: { title: true } } } };
  const transformed = applyDefaultReadFilter("Task", args) as any;
  assert.equal(transformed.select.epic.select.deletedAt, true);
  assert.deepEqual(sanitizeVisibleResult("Task", { epic: { title: "hidden", deletedAt: new Date() } }, args), { epic: null });
  assert.deepEqual(sanitizeVisibleResult("Task", { epic: { title: "visible", deletedAt: null } }, args), { epic: { title: "visible" } });
  assert.deepEqual(sanitizeVisibleResult("Task", { epic: { title: "hidden", deletedAt: null, project: { status: "ARCHIVED" } } }, args), { epic: null });
  assert.deepEqual(sanitizeVisibleResult("Task", { epic: { title: "visible", deletedAt: null, project: { status: "ACTIVE" } } }, args), { epic: { title: "visible" } });
});

test("F5/E10 request-facing reads exclude deleted and archived rows", () => {
  assert.deepEqual(applyDefaultReadFilter("Task", { where: { status: "TODO" } }), { where: { status: "TODO", deletedAt: null, project: { status: "ACTIVE" } } });
});

test("F5/E10 relation-backed project filters use valid paths", () => {
  assert.deepEqual(applyDefaultReadFilter("ProposalEpic", {}), { where: { proposal: { project: { status: "ACTIVE" } } } });
  assert.deepEqual(applyDefaultReadFilter("ItemSummary", {}), { where: { item: { project: { status: "ACTIVE" } } } });
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

test("F2/E4-E6/E25 visibility registry covers every request-facing model and relation chain", () => {
  assert.deepEqual(Object.keys(VISIBILITY_POLICY).sort(), [
    "ActivityItem", "AiProposal", "AiSession", "Checkpoint", "Epic", "ItemSummary", "LlmCall", "Project", "ProjectDigest", "ProjectMember", "ProposalEpic", "Sprint", "Standup", "Task", "TaskEvent", "User",
  ]);
  assert.deepEqual(VISIBILITY_POLICY.Task.relations, { project: "Project", epic: "Epic", sprint: "Sprint", assignee: "ProjectMember", creator: "User", events: "TaskEvent" });
  assert.equal(VISIBILITY_POLICY.AiSession.projectScope, "nullable");
  assert.equal(VISIBILITY_POLICY.Project.projectScope, "root");
});

test("F2/E5 nested reads carry visibility filters through to-many relations and counts", () => {
  assert.deepEqual(applyDefaultReadFilter("Project", {
    include: {
      tasks: { where: { status: "TODO" }, include: { events: true } },
      _count: { select: { tasks: true } },
    },
  }), {
    include: {
      tasks: { where: { status: "TODO", deletedAt: null, project: { status: "ACTIVE" } }, include: { events: { where: { project: { status: "ACTIVE" } } } } },
      _count: { select: { tasks: { where: { deletedAt: null, project: { status: "ACTIVE" } } } } },
    },
    where: { status: "ACTIVE" },
  });
});

test("F2/E5 nested to-one results are scrubbed and user memberships are registered", () => {
  assert.ok(VISIBILITY_POLICY.User);
  assert.deepEqual(applyDefaultReadFilter("Task", { include: { epic: true } }), {
    include: { epic: { include: { project: {} } } },
    where: { deletedAt: null, project: { status: "ACTIVE" } },
  });
  assert.deepEqual(sanitizeVisibleResult("Task", { id: "t", deletedAt: null, project: { status: "ACTIVE" }, epic: { deletedAt: new Date(), project: { status: "ACTIVE" } } }), { id: "t", deletedAt: null, project: { status: "ACTIVE" }, epic: null });
});

test("F3/E7-E8/E19-E20 compound unique selectors are normalized before findFirst", () => {
  assert.deepEqual(normalizeUniqueSelector("ProjectMember", { projectId_userId: { projectId: "p", userId: "u" } }), { projectId: "p", userId: "u" });
  assert.deepEqual(normalizeUniqueSelector("ProposalEpic", { proposalId_index: { proposalId: "p", index: 2 } }), { proposalId: "p", index: 2 });
  assert.deepEqual(normalizeUniqueSelector("ActivityItem", { projectId_uploadedBy_itemType_repo_externalId: { projectId: "p", uploadedBy: "u", itemType: "COMMIT", repo: "r", externalId: "e" } }), { projectId: "p", uploadedBy: "u", itemType: "COMMIT", repo: "r", externalId: "e" });
  assert.deepEqual(normalizeUniqueSelector("ItemSummary", { itemId_contentHash_guardVersion_promptVersion: { itemId: "i", contentHash: "h", guardVersion: "g", promptVersion: "p" } }), { itemId: "i", contentHash: "h", guardVersion: "g", promptVersion: "p" });
  assert.deepEqual(normalizeUniqueSelector("Standup", { projectId_developerId_standupDate: { projectId: "p", developerId: "d", standupDate: "2026-11-02" } }), { projectId: "p", developerId: "d", standupDate: "2026-11-02" });
  assert.deepEqual(normalizeUniqueSelector("Checkpoint", { projectId_id: { projectId: "p", id: "c" } }), { projectId: "p", id: "c" });
  assert.deepEqual(normalizeUniqueSelector("Epic", { projectId_id: { projectId: "p", id: "e" } }), { projectId: "p", id: "e" });
  assert.deepEqual(normalizeUniqueSelector("Sprint", { projectId_id: { projectId: "p", id: "s" } }), { projectId: "p", id: "s" });
});

test("F3/E20 malformed compound selectors fail closed before Prisma", () => {
  assert.throws(() => normalizeUniqueSelector("Standup", { projectId_developerId_standupDate: { projectId: "p" } }), /NOT_FOUND/);
});

test("registry covers every Prisma model and unknown models fail closed", () => {
  assert.deepEqual([...Object.keys(VISIBILITY_POLICY), "LlmGatewayState", "RateCounter"].sort(), Prisma.dmmf.datamodel.models.map((model) => model.name).sort());
  assert.throws(() => applyDefaultReadFilter("UnknownModel", {}), /visibility/i);
});

test('write operations filter targets and nested results', async () => {
  let extension: any; let received: any;
  const db = createDbClient({ $extends: (value: any) => { extension = value; return {}; } } as never);
  void db;
  const result = await extension.query.$allModels.update({ model: 'Task', args: { where: { id: 't' }, include: { epic: true } }, query: async (args: any) => { received = args; return { id: 't', epic: { deletedAt: new Date(), project: { status: 'ACTIVE' } } }; } });
  assert.equal(received.where.deletedAt, null);
  assert.equal(result.epic, null);
});
