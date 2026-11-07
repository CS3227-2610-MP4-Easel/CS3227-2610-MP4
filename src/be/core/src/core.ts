import { NotMember, type Core } from "@agile/contracts";

type Row = Record<string, unknown>;
type FindFirst = (args: Record<string, unknown>) => Promise<Row | null>;

export type CoreDb = {
  project?: { findFirst: FindFirst };
  projectMember?: { findFirst: FindFirst };
};

export type CoreDependencies = {
  db: CoreDb;
  /** This seam is deliberately injected: the filtered request client hides archived projects. */
  archivedMembership?: (userId: string, projectId: string) => Promise<boolean>;
};

const unavailable = async (): Promise<never> => { throw new Error("CORE_OPERATION_UNAVAILABLE"); };

export function createCore({ db, archivedMembership = async () => false }: CoreDependencies): Core {
  return {
    async requireMember(userId, projectId) {
      const membership = await db.projectMember?.findFirst({ where: { userId, projectId } });
      if (membership && !await archivedMembership(userId, projectId)) return;
      throw new NotMember();
    },
    async assertWritable(projectId) {
      const project = await db.project?.findFirst({ where: { id: projectId }, select: { status: true } });
      if (project?.status !== "ACTIVE") throw new Error("CONFLICT_STATE");
    },
    progress: unavailable,
    velocity: unavailable,
    applyPlan: unavailable,
    applyReplan: unavailable,
  };
}
