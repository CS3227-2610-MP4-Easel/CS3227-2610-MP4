import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getTierTarget, validateDatabaseTarget } from "../src/tier-targets.js";

export type SeedClient = Pick<PrismaClient, "user" | "project" | "projectMember" | "checkpoint" | "epic" | "sprint" | "task">;

const IDS = {
  pm: "00000000-0000-4000-8000-000000000001",
  lead: "00000000-0000-4000-8000-000000000002",
  developer: "00000000-0000-4000-8000-000000000003",
  project: "00000000-0000-4000-8000-000000000010",
  checkpoint: "00000000-0000-4000-8000-000000000020",
  epic: "00000000-0000-4000-8000-000000000030",
  sprint1: "00000000-0000-4000-8000-000000000041",
  sprint2: "00000000-0000-4000-8000-000000000042",
  sprint3: "00000000-0000-4000-8000-000000000043",
  task1: "00000000-0000-4000-8000-000000000051",
  task2: "00000000-0000-4000-8000-000000000052",
} as const;

const CREATED_AT = new Date("2026-01-05T00:00:00.000Z");
const day = (value: string) => new Date(`${value}T00:00:00.000Z`);

/** Inserts the complete W13 Tier 1 demo dataset using stable primary keys and upserts. */
export async function seedDemoData(db: SeedClient): Promise<void> {
  await db.user.upsert({ where: { firebaseUid: "w13-demo-pm" }, create: { id: IDS.pm, firebaseUid: "w13-demo-pm", email: "pm@example.invalid", displayName: "Priya Manager", role: "PM", createdAt: CREATED_AT }, update: { email: "pm@example.invalid", displayName: "Priya Manager", role: "PM" } });
  await db.user.upsert({ where: { firebaseUid: "w13-demo-lead" }, create: { id: IDS.lead, firebaseUid: "w13-demo-lead", email: "lead@example.invalid", displayName: "Leon Lead", role: "DEV_LEAD", createdAt: CREATED_AT }, update: { email: "lead@example.invalid", displayName: "Leon Lead", role: "DEV_LEAD" } });
  await db.user.upsert({ where: { firebaseUid: "w13-demo-developer" }, create: { id: IDS.developer, firebaseUid: "w13-demo-developer", email: "developer@example.invalid", displayName: "Dara Developer", role: "DEVELOPER", createdAt: CREATED_AT }, update: { email: "developer@example.invalid", displayName: "Dara Developer", role: "DEVELOPER" } });

  await db.project.upsert({ where: { id: IDS.project }, create: { id: IDS.project, name: "W13 Delivery Demo", brief: "Deterministic non-production demo project", status: "ACTIVE", createdBy: IDS.pm, createdAt: CREATED_AT, updatedAt: CREATED_AT }, update: { name: "W13 Delivery Demo", brief: "Deterministic non-production demo project", status: "ACTIVE", createdBy: IDS.pm } });
  for (const userId of [IDS.pm, IDS.lead, IDS.developer]) await db.projectMember.upsert({ where: { projectId_userId: { projectId: IDS.project, userId } }, create: { projectId: IDS.project, userId, addedBy: IDS.pm, addedAt: CREATED_AT }, update: { addedBy: IDS.pm } });

  await db.checkpoint.upsert({ where: { id: IDS.checkpoint }, create: { id: IDS.checkpoint, projectId: IDS.project, name: "MVP checkpoint", targetDate: day("2026-03-31"), createdAt: CREATED_AT, updatedAt: CREATED_AT }, update: { name: "MVP checkpoint", targetDate: day("2026-03-31") } });
  await db.epic.upsert({ where: { id: IDS.epic }, create: { id: IDS.epic, projectId: IDS.project, checkpointId: IDS.checkpoint, title: "Deployment readiness", description: "Make the platform safe to ship", position: 1, createdAt: CREATED_AT, updatedAt: CREATED_AT }, update: { checkpointId: IDS.checkpoint, title: "Deployment readiness", description: "Make the platform safe to ship", position: 1 } });

  const sprints = [
    [IDS.sprint1, "Sprint 1", "2026-01-05", "2026-01-18", 13],
    [IDS.sprint2, "Sprint 2", "2026-01-19", "2026-02-01", 21],
    [IDS.sprint3, "Sprint 3", "2026-02-02", "2026-02-15", 18],
  ] as const;
  for (const [id, name, start, end, completedPoints] of sprints) await db.sprint.upsert({ where: { id }, create: { id, projectId: IDS.project, name, startDate: day(start), endDate: day(end), status: "CLOSED", completedPoints, createdAt: CREATED_AT, updatedAt: CREATED_AT }, update: { name, startDate: day(start), endDate: day(end), status: "CLOSED", completedPoints } });
  await db.task.upsert({ where: { id: IDS.task1 }, create: { id: IDS.task1, projectId: IDS.project, epicId: IDS.epic, sprintId: IDS.sprint1, assigneeId: IDS.developer, title: "Configure deployment tiers", description: "Bind each environment to its allowed resources", acceptanceCriteria: ["Preview has no data credentials"], status: "DONE", blocked: false, storyPoints: 5, doneAt: day("2026-01-17"), createdBy: IDS.pm, createdAt: CREATED_AT, updatedAt: CREATED_AT }, update: { title: "Configure deployment tiers", status: "DONE", storyPoints: 5, assigneeId: IDS.developer } });
  await db.task.upsert({ where: { id: IDS.task2 }, create: { id: IDS.task2, projectId: IDS.project, epicId: IDS.epic, sprintId: IDS.sprint2, assigneeId: IDS.lead, title: "Verify recovery evidence", description: "Document backup and restore checks", acceptanceCriteria: ["Evidence includes RPO and RTO"], status: "DONE", blocked: false, storyPoints: 8, doneAt: day("2026-01-31"), createdBy: IDS.pm, createdAt: CREATED_AT, updatedAt: CREATED_AT }, update: { title: "Verify recovery evidence", status: "DONE", storyPoints: 8, assigneeId: IDS.lead } });
}

export async function runSeed(env: Record<string, string | undefined> = process.env): Promise<void> {
  const databaseUrl = env.DATABASE_URL;
  const target = getTierTarget(env.APP_TIER);
  if (target.tier !== "local" && target.tier !== "dev" && target.tier !== "test") throw new Error("Seed is not permitted for production or unsupported tiers");
  validateDatabaseTarget(env, env.APP_TIER, databaseUrl);
  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl! }) });
  try { await seedDemoData(client); } finally { await client.$disconnect(); }
}

if (import.meta.url === `file://${process.argv[1]}`) runSeed().catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
