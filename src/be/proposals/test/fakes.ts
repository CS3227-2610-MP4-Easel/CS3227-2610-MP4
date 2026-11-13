import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

export const integrationUrl = process.env.W1_INTEGRATION_DATABASE_URL;

type Role = "PM" | "DEV_LEAD" | "DEVELOPER";

export type Fixtures = {
  applicationName: string;
  user: (role?: Role) => Promise<string>;
  project: (createdBy: string) => Promise<string>;
  member: (projectId: string, userId: string) => Promise<void>;
  epic: (projectId: string, title?: string) => Promise<string>;
  aiSession: (userId: string, projectId: string) => Promise<string>;
};

/** Runs `run` against the real database with fixtures that are deleted afterwards (proposals first). */
export async function withIntegrationDb(run: (base: PrismaClient, fixtures: Fixtures) => Promise<void>, transactionTimeout?: number): Promise<void> {
  const tag = randomUUID();
  const applicationName = `proposals-test-${tag}`;
  const url = new URL(integrationUrl!);
  url.searchParams.set("application_name", applicationName);
  const base = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }), ...(transactionTimeout ? { transactionOptions: { timeout: transactionTimeout } } : {}) });
  const userIds: string[] = [];
  const projectIds: string[] = [];
  const fixtures: Fixtures = {
    applicationName,
    user: async (role = "PM") => {
      const created = await base.user.create({ data: { firebaseUid: `${tag}-${randomUUID()}`, email: `${randomUUID()}@${tag}.test`, displayName: "Proposals test", role } });
      userIds.push(created.id);
      return created.id;
    },
    project: async (createdBy) => {
      const created = await base.project.create({ data: { name: `Proposals test ${tag}`, createdBy } });
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
    aiSession: async (userId, projectId) => (await base.aiSession.create({ data: { feature: "PM_PLAN_OUTLINE", userId, projectId, env: "test" } })).id,
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
