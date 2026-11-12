import assert from "node:assert/strict";
import test from "node:test";
import { createCoreComposition } from "../src/core-composition.js";

const PROPOSAL = "0b7f6a3e-1c1d-4e5a-8f21-3c9d2a4b5e60";
const PROJECT = "1c8a7b4f-2d2e-4f6b-9a32-4d0e3b5c6f71";
const OWNER = "2d9b8c5a-3e3f-4a7c-8b43-5e1f4c6d7a82";

const auth = {
  db: {
    aiProposal: { findFirst: async ({ where }: { where: { id: string } }) => where.id === PROPOSAL ? { id: PROPOSAL, projectId: PROJECT, createdBy: OWNER } : null },
    project: { findFirst: async ({ where }: { where: { id: string } }) => where.id === PROJECT ? { id: PROJECT, status: "ACTIVE" } : null },
  },
  lookupUserByEmail: async () => null,
  lookupUserRole: async () => null,
  lookupArchivedMembership: async () => false,
} as never;

// One test for the W7 wiring into W5's composition: the four proposal operations resolve through the stored proposal, endpoint 34 through the project, and unknown ids to nothing.
test("W7 composition resolves the proposal operations and the plan-create project", async () => {
  const { resolveResource } = createCoreComposition(auth);
  for (const operation of ["PM_PROPOSAL_READ", "PM_EPIC_EXPAND", "PM_PROPOSAL_APPROVE", "PM_PROPOSAL_REJECT", "PM_EPIC_UPDATE", "PM_EPIC_REGENERATE", "PM_PROPOSAL_CHECKPOINTS_UPDATE", "PM_PROPOSAL_EPIC_CREATE", "PM_PROPOSAL_EPIC_DELETE", "PM_PROPOSAL_EXPAND_ALL"]) {
    assert.deepEqual(await resolveResource(operation, { params: { proposalId: PROPOSAL } } as never, undefined as never), { kind: "PROPOSAL", projectId: PROJECT, ownerId: OWNER, state: "ACTIVE" }, operation);
    assert.equal(await resolveResource(operation, { params: { proposalId: "3e0c9d6b-4f4a-4b8d-9c54-6f2a5d7e8b93" } } as never, undefined as never), null, `${operation} unknown`);
  }
  assert.deepEqual(await resolveResource("PM_PROPOSAL_LIST", { params: { id: PROJECT } } as never, undefined as never), { kind: "PROJECT", projectId: PROJECT, state: "ACTIVE" });
  assert.deepEqual(await resolveResource("PM_PLAN_CREATE", { params: { id: PROJECT } } as never, undefined as never), { kind: "PROJECT", projectId: PROJECT, state: "ACTIVE" });
});
