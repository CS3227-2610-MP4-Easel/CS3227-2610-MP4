import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

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
