import { type Clock, systemClock } from "./clock.js";
import { forecast, projectCompletion, singaporeDate } from "./forecast.js";

type Query = Record<string, unknown>;
type FindMany<T> = { findMany(args: Query): Promise<T[]> };
type Task = { id?: string; projectId: string; assigneeId?: string | null; storyPoints: number | null; status: string; deletedAt?: Date | null; sprintId?: string | null };
type Sprint = { id: string; name: string; completedPoints: number | null; startDate: Date; endDate: Date; projectId?: string; deletedAt?: Date | null };
type Checkpoint = { id: string; projectId: string; name: string; targetDate: Date; deletedAt?: Date | null; epics?: Array<{ id?: string; projectId: string; deletedAt?: Date | null; tasks?: Task[] }> };
type Member = { projectId: string; userId: string; project?: { id: string; name: string; status?: string }; user?: { id: string; displayName: string }; assignedTasks?: Task[] };
const PAGE_SIZE = 100;
const SPRINT_CONCURRENCY = 4;

export type FactsDb = {
  task?: FindMany<Task>;
  sprint?: FindMany<Sprint>;
  checkpoint?: FindMany<Checkpoint>;
  projectMember?: FindMany<Member>;
};

export type Facts = {
  asOf: string; pointsTotal: number; pointsDone: number; pointsRemaining: number; unestimatedTasks: number;
  velocity: Array<{ sprintId: string; name: string; completedPoints: number }>; avgVelocity: number | null; projectedCompletionDate: string | null;
  checkpoints: Array<{ id: string; name: string; targetDate: string; remainingPoints: number; projectedDate: string | null; risk: "ON_TRACK" | "AT_RISK" | "UNKNOWN" }>;
  overload: Array<{ userId: string; displayName: string; openPoints: number; avgCompletedPerSprint: number | null; projects: Array<{ projectId: string; name: string; openPoints: number }> }>;
};

const activeProject = { status: "ACTIVE" };
const liveTask = (projectId?: string): Query => ({ ...(projectId ? { projectId } : {}), deletedAt: null, project: activeProject, epic: { ...(projectId ? { projectId } : {}), deletedAt: null, project: activeProject } });
const points = (tasks: Task[], done: boolean) => tasks.reduce((total, task) => total + (task.storyPoints == null || (done ? task.status !== "DONE" : task.status === "DONE") ? 0 : task.storyPoints), 0);
const isLiveTask = (task: Task, projectId: string) => task.projectId === projectId && task.deletedAt == null;

async function allPages<T>(findMany: FindMany<T> | undefined, args: Query): Promise<T[]> {
  if (!findMany) return [];
  const rows: T[] = [];
  for (let skip = 0; ; skip += PAGE_SIZE) {
    const page = await findMany.findMany({ ...args, skip, take: PAGE_SIZE });
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

const checkpointSelect = { id: true, projectId: true, name: true, targetDate: true, deletedAt: true };
const checkpointRelations = (projectId: string, epicSkip = 0, epicId?: string, taskSkip = 0) => ({
  epics: {
    where: { ...(epicId ? { id: epicId } : {}), projectId, deletedAt: null, project: activeProject }, orderBy: { id: "asc" }, ...(epicId ? {} : { skip: epicSkip }), take: PAGE_SIZE,
    select: { id: true, projectId: true, deletedAt: true, tasks: { where: liveTask(projectId), orderBy: { id: "asc" }, ...(epicId ? { skip: taskSkip } : {}), take: PAGE_SIZE, select: { id: true, projectId: true, storyPoints: true, status: true, deletedAt: true } } },
  },
});

function appendNew<T extends { id?: string }>(target: T[], page: T[]): boolean {
  let added = false;
  for (const row of page) {
    if (row.id == null || !target.some(({ id }) => id === row.id)) {
      target.push(row);
      added = true;
    }
  }
  return added;
}

async function readCheckpoints(db: FactsDb, projectId: string): Promise<Checkpoint[]> {
  if (!db.checkpoint) return [];
  const checkpoints = await allPages(db.checkpoint, {
    where: { projectId, deletedAt: null, project: activeProject },
    orderBy: [{ targetDate: "asc" }, { id: "asc" }],
    select: checkpointSelect,
  });

  for (const checkpoint of checkpoints) {
    const epics = checkpoint.epics ?? [];
    if (checkpoint.epics == null) {
      const rows = await db.checkpoint.findMany({ where: { id: checkpoint.id, projectId, deletedAt: null, project: activeProject }, select: checkpointRelations(projectId) });
      epics.push(...(rows[0]?.epics ?? []));
      checkpoint.epics = epics;
    }
    for (let skip = PAGE_SIZE; epics.length >= skip; skip += PAGE_SIZE) {
      if (epics.length < skip) break;
      const rows = await db.checkpoint.findMany({
        where: { id: checkpoint.id, projectId, deletedAt: null, project: activeProject },
        select: checkpointRelations(projectId, skip),
      });
      const page = rows[0]?.epics ?? [];
      if (!page.length || !appendNew(epics, page)) break;
    }
    for (const epic of epics) {
      const tasks = epic.tasks ?? [];
      if (epic.id == null) continue;
      for (let skip = PAGE_SIZE; tasks.length >= skip; skip += PAGE_SIZE) {
        const rows = await db.checkpoint.findMany({
          where: { id: checkpoint.id, projectId, deletedAt: null, project: activeProject },
          select: checkpointRelations(projectId, 0, epic.id, skip),
        });
        const page = rows[0]?.epics?.[0]?.tasks ?? [];
        if (!page.length || !appendNew(tasks, page)) break;
      }
    }
  }
  return checkpoints;
}

function averageSprintDays(sprints: Sprint[]): number | null {
  if (!sprints.length) return null;
  const days = sprints.reduce((sum, sprint) => sum + Math.round((sprint.endDate.getTime() - sprint.startDate.getTime()) / 86_400_000) + 1, 0) / sprints.length;
  return Math.floor(days + 0.5);
}

async function completeSprints(db: FactsDb, projectIds: Set<string>): Promise<Sprint[]> {
  const ids = [...projectIds].sort();
  const result: Sprint[][] = Array.from({ length: ids.length }, () => []);
  let next = 0;
  const read = async () => {
    while (next < ids.length) {
      const index = next++;
      const projectId = ids[index];
      const sprints = await db.sprint?.findMany({
      where: { projectId, deletedAt: null, status: "CLOSED", project: activeProject },
      orderBy: [{ endDate: "desc" }, { id: "asc" }],
      take: 3,
      select: { id: true, name: true, completedPoints: true, startDate: true, endDate: true, projectId: true, deletedAt: true },
      });
      result[index] = (sprints ?? []).filter((sprint) => sprint.projectId === projectId && sprint.deletedAt == null)
      .sort((a, b) => b.endDate.getTime() - a.endDate.getTime() || a.id.localeCompare(b.id)).slice(0, 3);
    }
  };
  await Promise.all(Array.from({ length: Math.min(SPRINT_CONCURRENCY, ids.length) }, read));
  return result.flat();
}

function overload(members: Member[], projectIds: Set<string>, sprints: Sprint[], requireMultipleProjects: boolean) {
  const byUser = new Map<string, { displayName: string; projects: Map<string, { name: string; openPoints: number }>; completed: number }>();
  const sprintIds = new Set(sprints.map(({ id }) => id));
  for (const member of members) {
    if (!projectIds.has(member.projectId) || member.project?.status === "ARCHIVED" || !member.user) continue;
    const record = byUser.get(member.userId) ?? { displayName: member.user.displayName, projects: new Map(), completed: 0 };
    const tasks = (member.assignedTasks ?? []).filter((task) => isLiveTask(task, member.projectId) && task.assigneeId === member.userId);
    const openPoints = points(tasks, false);
    if (openPoints > 0) record.projects.set(member.projectId, { name: member.project?.name ?? "", openPoints });
    record.completed += tasks.filter((task) => task.status === "DONE" && task.sprintId && sprintIds.has(task.sprintId)).reduce((sum, task) => sum + (task.storyPoints ?? 0), 0);
    byUser.set(member.userId, record);
  }
  return [...byUser.entries()].filter(([, value]) => value.projects.size >= (requireMultipleProjects ? 2 : 1)).sort(([a], [b]) => a.localeCompare(b)).map(([userId, value]) => ({
    userId, displayName: value.displayName, openPoints: [...value.projects.values()].reduce((sum, project) => sum + project.openPoints, 0),
    avgCompletedPerSprint: sprints.length ? value.completed / sprints.length : null,
    projects: [...value.projects.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([projectId, project]) => ({ projectId, ...project })),
  }));
}

export function createFacts(db: FactsDb, clock: Clock = systemClock) {
  async function build(projectId: string, memberProjectIds: Set<string>, requireMultipleProjects: boolean): Promise<Facts> {
    const now = clock.now();
    const asOf = now.toISOString();
    const [taskRows, sprintRows, checkpointRows, memberRows] = await Promise.all([
      allPages(db.task, { where: liveTask(projectId), orderBy: { id: "asc" }, select: { id: true, projectId: true, storyPoints: true, status: true, deletedAt: true } }),
      completeSprints(db, memberProjectIds),
      readCheckpoints(db, projectId),
      allPages(db.projectMember, { where: { projectId: { in: [...memberProjectIds] }, project: activeProject }, orderBy: [{ projectId: "asc" }, { userId: "asc" }], select: { projectId: true, userId: true, project: { select: { id: true, name: true, status: true } }, user: { select: { id: true, displayName: true } } } }),
    ]);
    const assignedTasks = await allPages(db.task, { where: { ...liveTask(), project: activeProject, projectId: { in: [...memberProjectIds] }, assigneeId: { not: null } }, orderBy: { id: "asc" }, select: { id: true, projectId: true, assigneeId: true, storyPoints: true, status: true, deletedAt: true, sprintId: true } });
    const tasksByMember = new Map(memberRows.map((member) => [`${member.projectId}:${member.userId}`, [...(member.assignedTasks ?? [])]]));
    for (const task of assignedTasks) {
      const key = `${task.projectId}:${task.assigneeId}`;
      const existing = tasksByMember.get(key);
      if (existing && !existing.some(({ id }) => id != null && id === task.id)) existing.push(task);
    }
    for (const member of memberRows) member.assignedTasks = tasksByMember.get(`${member.projectId}:${member.userId}`) ?? [];
    const tasks = taskRows.filter((task) => isLiveTask(task, projectId));
    const allSprints = sprintRows;
    const sprints = allSprints.filter((sprint) => sprint.projectId == null || sprint.projectId === projectId);
    const velocity = sprints.filter((sprint) => sprint.completedPoints != null).map((sprint) => ({ sprintId: sprint.id, name: sprint.name, completedPoints: sprint.completedPoints! }));
    const avgVelocity = velocity.length ? velocity.reduce((sum, sprint) => sum + sprint.completedPoints, 0) / velocity.length : null;
    const sprintDays = averageSprintDays(sprints);
    const pointsTotal = tasks.reduce((sum, task) => sum + (task.storyPoints ?? 0), 0);
    const pointsDone = points(tasks, true);
    const pointsRemaining = points(tasks, false);
    const checkpoints = checkpointRows.filter((checkpoint) => checkpoint.projectId === projectId && checkpoint.deletedAt == null).sort((a, b) => singaporeDate(a.targetDate).localeCompare(singaporeDate(b.targetDate)) || a.id.localeCompare(b.id)).map((checkpoint) => {
      const remainingPoints = (checkpoint.epics ?? []).filter((epic) => epic.projectId === projectId && epic.deletedAt == null).flatMap((epic) => epic.tasks ?? []).filter((task) => isLiveTask(task, projectId)).reduce((sum, task) => sum + (task.status === "DONE" ? 0 : task.storyPoints ?? 0), 0);
      const targetDate = singaporeDate(checkpoint.targetDate);
      return { id: checkpoint.id, name: checkpoint.name, targetDate, remainingPoints, ...forecast(singaporeDate(now), targetDate, remainingPoints, avgVelocity, sprintDays) };
    });
    return { asOf, pointsTotal, pointsDone, pointsRemaining, unestimatedTasks: tasks.filter((task) => task.storyPoints == null).length, velocity, avgVelocity, projectedCompletionDate: projectCompletion(singaporeDate(now), pointsRemaining, avgVelocity, sprintDays), checkpoints, overload: overload(memberRows, memberProjectIds, allSprints, requireMultipleProjects) };
  }

  return {
    target: (projectId: string) => build(projectId, new Set([projectId]), false),
    async caller(callerId: string, projectId: string) {
      const memberships = await allPages(db.projectMember, { where: { userId: callerId, project: activeProject }, orderBy: { projectId: "asc" }, select: { projectId: true } });
      const projectIds = new Set(memberships.map(({ projectId }) => projectId));
      if (!projectIds.has(projectId)) throw new Error("NOT_MEMBER");
      return build(projectId, projectIds, true);
    },
  };
}
