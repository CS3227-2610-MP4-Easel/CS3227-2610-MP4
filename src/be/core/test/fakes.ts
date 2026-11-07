import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

export const integrationUrl = process.env.W1_INTEGRATION_DATABASE_URL;

type Role = "PM" | "DEV_LEAD" | "DEVELOPER";

export type Fixtures = {
  user: (role?: Role) => Promise<string>;
  project: (createdBy: string) => Promise<string>;
  member: (projectId: string, userId: string) => Promise<void>;
};

/** Runs `run` against the real database with fixtures that are deleted afterwards. */
export async function withIntegrationDb(run: (base: PrismaClient, fixtures: Fixtures) => Promise<void>): Promise<void> {
  const base = new PrismaClient({ adapter: new PrismaPg({ connectionString: integrationUrl }) });
  const tag = randomUUID();
  const userIds: string[] = [];
  const projectIds: string[] = [];
  const fixtures: Fixtures = {
    user: async (role = "PM") => {
      const created = await base.user.create({ data: { firebaseUid: `${tag}-${randomUUID()}`, email: `${randomUUID()}@${tag}.test`, displayName: "Core test", role } });
      userIds.push(created.id);
      return created.id;
    },
    project: async (createdBy) => {
      const created = await base.project.create({ data: { name: `Core test ${tag}`, createdBy } });
      projectIds.push(created.id);
      return created.id;
    },
    member: async (projectId, userId) => {
      await base.projectMember.create({ data: { projectId, userId, addedBy: userId } });
    },
  };
  try {
    await run(base, fixtures);
  } finally {
    try {
      try {
        await base.taskEvent.deleteMany({ where: { projectId: { in: projectIds } } });
      } finally {
        try {
          await base.task.deleteMany({ where: { projectId: { in: projectIds } } });
        } finally {
          try {
            await base.epic.deleteMany({ where: { projectId: { in: projectIds } } });
          } finally {
            try {
              await base.checkpoint.deleteMany({ where: { projectId: { in: projectIds } } });
            } finally {
              try {
                await base.projectMember.deleteMany({ where: { projectId: { in: projectIds } } });
              } finally {
                try {
                  await base.project.deleteMany({ where: { id: { in: projectIds } } });
                } finally {
                  await base.user.deleteMany({ where: { id: { in: userIds } } });
                }
              }
            }
          }
        }
      }
    } finally {
      await base.$disconnect();
    }
  }
}
