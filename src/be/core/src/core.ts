import { NotMember, type Core } from "@agile/contracts";
import { createApply, type ApplyDb } from "./apply.js";
import { createDerived, type DerivedDb } from "./derived.js";

type Row = Record<string, unknown>;
type FindFirst = (args: Record<string, unknown>) => Promise<Row | null>;

export type CoreDb = ApplyDb & DerivedDb & {
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
  const derived = createDerived(db);
  const apply = createApply();
  return {
    async requireMember(userId, projectId) {
      const membership = await db.projectMember?.findFirst({ where: { userId, projectId } });
      if (membership && !await archivedMembership(userId, projectId)) return;
      throw new NotMember();
    },
    async assertWritable(projectId) {
      const project = await db.project?.findFirst({ where: { id: projectId }, select: { status: true } });
      if (!project) throw new Error("NOT_FOUND");
      if (project.status !== "ACTIVE") throw new Error("CONFLICT_STATE");
    },
    progress: derived.progress,
    velocity: derived.velocity,
    applyPlan: apply.applyPlan,
    applyReplan: apply.applyReplan,
  };
}
