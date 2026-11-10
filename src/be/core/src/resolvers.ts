import type { ResolvedResource, ResourceResolver } from "@agile/contracts";

type Row = Record<string, unknown>;
type FindFirst = (args: Record<string, unknown>) => Promise<Row | null>;
type ResolverDb = {
  project?: { findFirst: FindFirst };
  checkpoint?: { findFirst: FindFirst };
  epic?: { findFirst: FindFirst };
  task?: { findFirst: FindFirst };
  projectMember?: { findFirst: FindFirst; findMany: (args: Record<string, unknown>) => Promise<Row[]> };
};
type Request = { params?: Record<string, unknown>; body?: unknown; userId?: string };
export type CoreResourceResolvers = Readonly<Record<string, (request: Request) => Promise<ResolvedResource | null>>>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const id = (request: Request, ...names: string[]) => {
  const value = names.map((name) => request.params?.[name]).find((candidate) => typeof candidate === "string");
  return typeof value === "string" && UUID.test(value) ? value : null;
};
const projectState = (row: Row): "ACTIVE" | "ARCHIVED" => row.status === "ARCHIVED" || (row.project as Row | undefined)?.status === "ARCHIVED" ? "ARCHIVED" : "ACTIVE";
const resource = (kind: Exclude<ResolvedResource["kind"], "PROJECT_SET">, row: Row, projectId: string, extra: Partial<ResolvedResource> = {}): ResolvedResource => ({ kind, projectId, state: projectState(row), ...extra } as ResolvedResource);

const PROJECT_OPERATIONS = ["PROJECT_READ", "PM_PROJECT_UPDATE", "PROJECT_MEMBER_LIST", "CHECKPOINT_LIST", "CHECKPOINT_CREATE", "EPIC_LIST", "EPIC_CREATE", "TASK_LIST", "TASK_CREATE", "SPRINT_LIST", "SPRINT_CREATE", "PROJECT_PROGRESS_READ", "PM_PLAN_CREATE"];
const CHECKPOINT_OPERATIONS = ["CHECKPOINT_UPDATE", "CHECKPOINT_DELETE"];
const EPIC_OPERATIONS = ["EPIC_UPDATE", "EPIC_DELETE"];
const TASK_OPERATIONS = ["TASK_READ", "TASK_UPDATE", "TASK_STATUS_UPDATE", "TASK_DELETE", "TASK_EVENT_LIST"];
const READ_OPERATIONS = new Set(["PROJECT_READ", "PROJECT_MEMBER_LIST", "CHECKPOINT_LIST", "EPIC_LIST", "TASK_LIST", "TASK_READ", "TASK_EVENT_LIST", "SPRINT_LIST", "PROJECT_PROGRESS_READ"]);

export function createCoreResourceResolvers(db: ResolverDb): CoreResourceResolvers {
  const resolve = (operation: string, value: ResolvedResource | null): ResolvedResource | null => value?.kind !== "PROJECT_SET" && value?.state === "ARCHIVED" && READ_OPERATIONS.has(operation) ? null : value;
  const project = (operation: string) => async (request: Request): Promise<ResolvedResource | null> => {
    const projectId = id(request, "projectId", "id");
    if (!projectId) return null;
    const row = await db.project?.findFirst({ where: { id: projectId }, select: { id: true, status: true } });
    return resolve(operation, row ? resource("PROJECT", row, projectId) : null);
  };
  const child = (operation: string, kind: "PROJECT" | "TASK", delegate: { findFirst: FindFirst } | undefined, extra?: (row: Row) => Partial<ResolvedResource>) => async (request: Request): Promise<ResolvedResource | null> => {
    const childId = id(request, "id");
    if (!childId) return null;
    const row = await delegate?.findFirst({ where: { id: childId }, select: { projectId: true, ...(kind === "TASK" ? { assigneeId: true } : {}), project: { select: { status: true } } } });
    const projectId = row?.projectId;
    if (!row || typeof projectId !== "string" || (id(request, "projectId") && id(request, "projectId") !== projectId)) return null;
    return resolve(operation, resource(kind, row, projectId, extra?.(row)));
  };
  const task = (operation: string) => child(operation, "TASK", db.task, (row) => typeof row.assigneeId === "string" ? { assigneeId: row.assigneeId } : {});
  const membership = async (request: Request): Promise<ResolvedResource | null> => {
    const projectId = id(request, "projectId", "id");
    if (!projectId) return null;
    if (request.params?.userId) {
      const userId = id(request, "userId");
      if (!userId) return null;
      const row = await db.projectMember?.findFirst({ where: { projectId, userId }, select: { projectId: true, user: { select: { role: true } }, project: { select: { status: true } } } });
      return row ? resource("MEMBERSHIP", row, projectId, { targetRole: (row.user as Row | undefined)?.role as ResolvedResource extends { targetRole?: infer Role } ? Role : never }) : null;
    }
    return null;
  };
  const addMembership = async (request: Request): Promise<ResolvedResource | null> => {
    const projectId = id(request, "projectId", "id");
    if (!projectId) return null;
    const row = await db.project?.findFirst({ where: { id: projectId }, select: { id: true, status: true } });
    return row ? resource("MEMBERSHIP", row, projectId) : null;
  };
  const projectList = async (request: Request): Promise<ResolvedResource | null> => {
    if (!request.userId || !UUID.test(request.userId)) return null;
    const memberships = await db.projectMember?.findMany({ where: { userId: request.userId, project: { status: "ACTIVE" } }, select: { projectId: true } });
    return memberships ? { kind: "PROJECT_SET", projectIds: memberships.map((membership) => membership.projectId).filter((projectId): projectId is string => typeof projectId === "string") } : null;
  };
  const registry: Record<string, (request: Request) => Promise<ResolvedResource | null>> = {};
  registry.PROJECT_LIST = projectList;
  for (const operation of PROJECT_OPERATIONS) registry[operation] = project(operation);
  registry.PROJECT_MEMBER_ADD = addMembership;
  for (const operation of CHECKPOINT_OPERATIONS) registry[operation] = child(operation, "PROJECT", db.checkpoint);
  for (const operation of EPIC_OPERATIONS) registry[operation] = child(operation, "PROJECT", db.epic);
  for (const operation of TASK_OPERATIONS) registry[operation] = task(operation);
  registry.PROJECT_MEMBER_REMOVE = membership;
  return Object.freeze(registry);
}

export function resolveCoreResource(resolvers: CoreResourceResolvers, operationId: string, request: Request): ReturnType<ResourceResolver> {
  return resolvers[operationId]?.(request) ?? Promise.resolve(null);
}
