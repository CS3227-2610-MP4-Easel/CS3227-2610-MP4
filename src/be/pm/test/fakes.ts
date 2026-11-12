import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import type { Sessions } from "@agile/contracts";
import { applyPlan } from "@agile/core";
import { createDbClient } from "@agile/db";
import { addEpic, approveProposal, claimEpic, claimPlanEpics, createProposal, deleteEpic, editEpic, failEpic, failPlanEpics, getProposalView, listProposals, precheckRegenerate, rejectProposal, replaceCheckpoints, storeEpic, storePlanEpics } from "@agile/proposals";
import type { ProposalsApi } from "../src/plan-flow.js";

export const integrationUrl = process.env.W1_INTEGRATION_DATABASE_URL;

type Role = "PM" | "DEV_LEAD" | "DEVELOPER";

export type Fixtures = {
  user: (role?: Role) => Promise<string>;
  project: (createdBy: string) => Promise<string>;
  member: (projectId: string, userId: string) => Promise<void>;
  epic: (projectId: string, title?: string) => Promise<string>;
  task: (projectId: string, epicId: string, createdBy: string, title?: string) => Promise<string>;
  archive: (projectId: string) => Promise<void>;
};

/** Runs `run` against the real database with fixtures that are deleted afterwards (children first). */
export async function withIntegrationDb(run: (base: PrismaClient, fixtures: Fixtures) => Promise<void>): Promise<void> {
  const base = new PrismaClient({ adapter: new PrismaPg({ connectionString: integrationUrl }) });
  const tag = randomUUID();
  const userIds: string[] = [];
  const projectIds: string[] = [];
  const fixtures: Fixtures = {
    user: async (role = "PM") => {
      const created = await base.user.create({ data: { firebaseUid: `${tag}-${randomUUID()}`, email: `${randomUUID()}@${tag}.test`, displayName: "PM test", role } });
      userIds.push(created.id);
      return created.id;
    },
    project: async (createdBy) => {
      const created = await base.project.create({ data: { name: `PM test ${tag}`, createdBy } });
      projectIds.push(created.id);
      return created.id;
    },
    member: async (projectId, userId) => {
      await base.projectMember.create({ data: { projectId, userId, addedBy: userId } });
    },
    epic: async (projectId, title = "Retrieved epic") => {
      const count = await base.epic.count({ where: { projectId } });
      return (await base.epic.create({ data: { projectId, title, position: count } })).id;
    },
    task: async (projectId, epicId, createdBy, title = "Retrieved task") =>
      (await base.task.create({ data: { projectId, epicId, createdBy, title } })).id,
    archive: async (projectId) => {
      await base.project.update({ where: { id: projectId }, data: { status: "ARCHIVED" } });
    },
  };
  const steps: Array<() => Promise<unknown>> = [
    () => base.proposalEpic.deleteMany({ where: { proposal: { projectId: { in: projectIds } } } }),
    () => base.aiProposal.deleteMany({ where: { projectId: { in: projectIds } } }),
    () => base.aiSession.deleteMany({ where: { OR: [{ projectId: { in: projectIds } }, { userId: { in: userIds } }] } }),
    () => base.taskEvent.deleteMany({ where: { projectId: { in: projectIds } } }),
    () => base.task.deleteMany({ where: { projectId: { in: projectIds } } }),
    () => base.epic.deleteMany({ where: { projectId: { in: projectIds } } }),
    () => base.checkpoint.deleteMany({ where: { projectId: { in: projectIds } } }),
    () => base.projectMember.deleteMany({ where: { projectId: { in: projectIds } } }),
    () => base.project.deleteMany({ where: { id: { in: projectIds } } }),
    () => base.user.deleteMany({ where: { id: { in: userIds } } }),
  ];
  try {
    await run(base, fixtures);
  } finally {
    try {
      for (const step of steps) {
        try { await step(); } catch { /* keep cleaning the rest; leftovers are tagged */ }
      }
    } finally {
      await base.$disconnect();
    }
  }
}

/** The real `@agile/proposals` functions bound to the integration database, core and sessions as a `ProposalsApi`. */
export function bindProposals(base: PrismaClient, sessions: Pick<Sessions, "close">): ProposalsApi {
  const db = createDbClient(base);
  const core = { applyPlan: (tx: unknown, projectId: string, plan: unknown, actorId: string) => applyPlan(tx as never, projectId, plan, actorId) };
  return {
    claimPlanEpics: (i) => claimPlanEpics(db, i),
    storePlanEpics: (i) => storePlanEpics(db, i),
    failPlanEpics: (i) => failPlanEpics(db, i),
    createProposal: (i) => createProposal(db, i),
    getProposalView: (proposalId, viewerId) => getProposalView(db, proposalId, viewerId),
    claimEpic: (i) => claimEpic(db, i),
    storeEpic: (i) => storeEpic(db, i),
    failEpic: (i) => failEpic(db, i),
    editEpic: (i) => editEpic(db, i),
    replaceCheckpoints: (i) => replaceCheckpoints(db, i),
    addEpic: (i) => addEpic(db, i),
    deleteEpic: (i) => deleteEpic(db, i),
    precheckRegenerate: (i) => precheckRegenerate(db, i),
    listProposals: (i) => listProposals(db, i),
    approveProposal: (i) => approveProposal({ db, core, sessions }, i),
    rejectProposal: (i) => rejectProposal({ db, sessions }, i),
  };
}
