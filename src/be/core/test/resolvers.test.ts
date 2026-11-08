import assert from "node:assert/strict";
import { test } from "node:test";
import { createCoreResourceResolvers } from "../src/index.js";

const projectId = "00000000-0000-4000-8000-000000000001";
const taskId = "00000000-0000-4000-8000-000000000002";
const otherProjectId = "00000000-0000-4000-8000-000000000003";
const userId = "00000000-0000-4000-8000-000000000004";

test("the registry maps every T1 operation to its frozen resource kind", async () => {
  const resolvers = createCoreResourceResolvers({
    project: { findFirst: async () => ({ id: projectId, status: "ACTIVE" }) },
    projectMember: { findFirst: async () => ({ projectId, user: { role: "DEVELOPER" }, project: { status: "ACTIVE" } }), findMany: async () => [{ projectId }] },
    checkpoint: { findFirst: async () => ({ projectId, project: { status: "ACTIVE" } }) },
    epic: { findFirst: async () => ({ projectId, project: { status: "ACTIVE" } }) },
    task: { findFirst: async () => ({ projectId, project: { status: "ACTIVE" } }) },
  });
  const expected: Array<[string, "PROJECT" | "TASK" | "MEMBERSHIP"]> = [
    ["PROJECT_READ", "PROJECT"], ["PM_PROJECT_UPDATE", "PROJECT"], ["PROJECT_MEMBER_LIST", "PROJECT"], ["PROJECT_MEMBER_ADD", "MEMBERSHIP"], ["PROJECT_MEMBER_REMOVE", "MEMBERSHIP"],
    ["CHECKPOINT_LIST", "PROJECT"], ["CHECKPOINT_CREATE", "PROJECT"], ["CHECKPOINT_UPDATE", "PROJECT"], ["CHECKPOINT_DELETE", "PROJECT"],
    ["EPIC_LIST", "PROJECT"], ["EPIC_CREATE", "PROJECT"], ["EPIC_UPDATE", "PROJECT"], ["EPIC_DELETE", "PROJECT"],
    ["TASK_LIST", "PROJECT"], ["TASK_CREATE", "PROJECT"], ["TASK_READ", "TASK"], ["TASK_UPDATE", "TASK"], ["TASK_STATUS_UPDATE", "TASK"], ["TASK_DELETE", "TASK"], ["TASK_EVENT_LIST", "TASK"],
    ["SPRINT_LIST", "PROJECT"], ["SPRINT_CREATE", "PROJECT"], ["PROJECT_PROGRESS_READ", "PROJECT"], ["PM_PLAN_CREATE", "PROJECT"],
  ];
  for (const [operation, kind] of expected) assert.equal((await resolvers[operation]({ params: { projectId, id: taskId, userId }, body: { email: "member@example.test", role: "PM" } }))?.kind, kind, operation);
  assert.deepEqual(await resolvers.PROJECT_LIST({ userId }), { kind: "PROJECT_SET", projectIds: [projectId] });
});

test("task operations reject malformed and cross-project child ids", async () => {
  const resolvers = createCoreResourceResolvers({ task: { findFirst: async () => ({ id: taskId, projectId, project: { status: "ACTIVE" }, assigneeId: null }) } });
  assert.deepEqual(await resolvers.TASK_READ({ params: { id: taskId } }), { kind: "TASK", projectId, state: "ACTIVE" });
  assert.equal(await resolvers.TASK_READ({ params: { id: "not-a-uuid" } }), null);
  assert.equal(await resolvers.TASK_READ({ params: { id: taskId, projectId: otherProjectId } }), null);
});

test("archived reads resolve absent while archived writes retain their state", async () => {
  const resolvers = createCoreResourceResolvers({ task: { findFirst: async () => ({ id: taskId, projectId, project: { status: "ARCHIVED" } }) } });
  assert.equal(await resolvers.TASK_READ({ params: { id: taskId } }), null);
  assert.deepEqual(await resolvers.TASK_UPDATE({ params: { id: taskId } }), { kind: "TASK", projectId, state: "ARCHIVED" });
});

test("add-member resolves pre-parse project scope without trusting a client role", async () => {
  const resolvers = createCoreResourceResolvers({ project: { findFirst: async () => ({ id: projectId, status: "ACTIVE" }) } });
  assert.deepEqual(await resolvers.PROJECT_MEMBER_ADD({ params: { projectId }, body: { email: "member@example.test", role: "DEV_LEAD" } }), { kind: "MEMBERSHIP", projectId, state: "ACTIVE" });
});

test("project list queries only memberships linked to active projects", async () => {
  const resolvers = createCoreResourceResolvers({
    projectMember: {
      findFirst: async () => null,
      findMany: async (args) => {
        assert.deepEqual(args.where, { userId, project: { status: "ACTIVE" } });
        return [{ projectId }];
      },
    },
  });
  assert.deepEqual(await resolvers.PROJECT_LIST({ userId }), { kind: "PROJECT_SET", projectIds: [projectId] });
});
