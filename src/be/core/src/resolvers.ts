import type { ResolvedResource, ResourceResolver } from "@agile/contracts";

type Row = Record<string, unknown>;
type FindFirst = (args: Record<string, unknown>) => Promise<Row | null>;
type ResolverDb = {
  project?: { findFirst: FindFirst };
  checkpoint?: { findFirst: FindFirst };
  epic?: { findFirst: FindFirst };
  task?: { findFirst: FindFirst };
  projectMember?: { findFirst: FindFirst };
};
type Request = { params?: Record<string, unknown>; body?: unknown };
export type CoreResourceResolvers = Readonly<Record<string, (request: Request) => Promise<ResolvedResource | null>>>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const id = (request: Request, ...names: string[]) => {
  const value = names.map((name) => request.params?.[name]).find((candidate) => typeof candidate === "string");
  return typeof value === "string" && UUID.test(value) ? value : null;
};
const projectState = (row: Row): "ACTIVE" | "ARCHIVED" => row.status === "ARCHIVED" || (row.project as Row | undefined)?.status === "ARCHIVED" ? "ARCHIVED" : "ACTIVE";
const resource = (kind: Exclude<ResolvedResource["kind"], "PROJECT_SET">, row: Row, projectId: string, extra: Partial<ResolvedResource> = {}): ResolvedResource => ({ kind, projectId, state: projectState(row), ...extra } as ResolvedResource);

const PROJECT_OPERATIONS = ["PROJECT_READ", "PM_PROJECT_UPDATE", "CHECKPOINT_LIST", "CHECKPOINT_CREATE", "EPIC_LIST", "EPIC_CREATE", "TASK_LIST", "TASK_CREATE", "SPRINT_LIST", "SPRINT_CREATE", "PROJECT_PROGRESS_READ", "PM_PLAN_CREATE"];
const CHECKPOINT_OPERATIONS = ["CHECKPOINT_UPDATE", "CHECKPOINT_DELETE"];
const EPIC_OPERATIONS = ["EPIC_UPDATE", "EPIC_DELETE"];
const TASK_OPERATIONS = ["TASK_READ", "TASK_UPDATE", "TASK_STATUS_UPDATE", "TASK_DELETE", "TASK_EVENT_LIST"];
const MEMBERSHIP_OPERATIONS = ["PROJECT_MEMBER_LIST", "PROJECT_MEMBER_ADD", "PROJECT_MEMBER_REMOVE"];

export function createCoreResourceResolvers(db: ResolverDb): CoreResourceResolvers {
  const project = async (request: Request): Promise<ResolvedResource | null> => {
    const projectId = id(request, "projectId", "id");
    if (!projectId) return null;
    const row = await db.project?.findFirst({ where: { id: projectId }, select: { id: true, status: true } });
    return row ? resource("PROJECT", row, projectId) : null;
  };
  const child = (kind: "PROJECT" | "TASK", delegate: { findFirst: FindFirst } | undefined, extra?: (row: Row) => Partial<ResolvedResource>) => async (request: Request): Promise<ResolvedResource | null> => {
    const childId = id(request, "id");
    if (!childId) return null;
    const row = await delegate?.findFirst({ where: { id: childId }, select: { projectId: true, assigneeId: true, project: { select: { status: true } } } });
    const projectId = row?.projectId;
    return row && typeof projectId === "string" ? resource(kind, row, projectId, extra?.(row)) : null;
  };
  const task = child("TASK", db.task, (row) => typeof row.assigneeId === "string" ? { assigneeId: row.assigneeId } : {});
  const membership = async (request: Request): Promise<ResolvedResource | null> => {
    const projectId = id(request, "projectId", "id");
    if (!projectId) return null;
    if (request.params?.userId) {
      const userId = id(request, "userId");
      if (!userId) return null;
      const row = await db.projectMember?.findFirst({ where: { projectId, userId }, select: { projectId: true, user: { select: { role: true } }, project: { select: { status: true } } } });
      return row ? resource("MEMBERSHIP", row, projectId, { targetRole: (row.user as Row | undefined)?.role as ResolvedResource extends { targetRole?: infer Role } ? Role : never }) : null;
    }
    const row = await db.project?.findFirst({ where: { id: projectId }, select: { status: true } });
    const role = typeof (request.body as Row | undefined)?.role === "string" ? (request.body as Row).role : undefined;
    return row && role ? resource("MEMBERSHIP", row, projectId, { targetRole: role as never }) : null;
  };
  const registry: Record<string, (request: Request) => Promise<ResolvedResource | null>> = {};
  for (const operation of PROJECT_OPERATIONS) registry[operation] = project;
  for (const operation of CHECKPOINT_OPERATIONS) registry[operation] = child("PROJECT", db.checkpoint);
  for (const operation of EPIC_OPERATIONS) registry[operation] = child("PROJECT", db.epic);
  for (const operation of TASK_OPERATIONS) registry[operation] = task;
  for (const operation of MEMBERSHIP_OPERATIONS) registry[operation] = membership;
  return Object.freeze(registry);
}

export function resolveCoreResource(resolvers: CoreResourceResolvers, operationId: string, request: Request): ReturnType<ResourceResolver> {
  return resolvers[operationId]?.(request) ?? Promise.resolve(null);
}
