import type { ResolvedResource } from "@agile/contracts";

type Request = { params: Record<string, string>; userId?: string };
export type DevResolverDeps = {
  db: unknown;
  lookupArchivedMembership(userId: string, projectId: string): Promise<boolean>;
  requireMember(userId: string, projectId: string): Promise<unknown>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createDevResolvers(deps: DevResolverDeps): Record<string, (request: Request) => Promise<ResolvedResource | null>> {
  const visible = async (projectId: string) => Boolean(await (deps.db as { project: { findFirst(args: unknown): Promise<unknown> } }).project.findFirst({ where: { id: projectId }, select: { id: true } }));
  const project = (archivedOk: boolean) => async (request: Request): Promise<ResolvedResource | null> => {
    const projectId = request.params.id;
    if (!projectId || !UUID.test(projectId)) return null;
    if (await visible(projectId)) return { kind: "PROJECT", projectId, state: "ACTIVE" };
    if (archivedOk && request.userId && await deps.lookupArchivedMembership(request.userId, projectId)) return { kind: "PROJECT", projectId, state: "ARCHIVED" };
    return null;
  };
  return {
    DEV_UPLOAD_CREATE: project(true),
    DEV_SUMMARY_CREATE: project(true),
    DEV_STANDUP_CREATE: project(true),
    LEAD_STANDUP_LIST: project(false),
    DEV_STANDUP_MINE_READ: async (request) => {
      const projectId = request.params.id;
      if (!projectId || !UUID.test(projectId) || !request.userId) return null;
      try { await deps.requireMember(request.userId, projectId); } catch { return null; }
      return { kind: "STANDUP", projectId, ownerId: request.userId, state: "ACTIVE" };
    },
  };
}
