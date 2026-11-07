type Row = Record<string, any>;

export type DerivedDb = {
  task?: { findMany(args: Row): Promise<Row[]> };
  sprint?: { findMany(args: Row): Promise<Row[]> };
};

export type Progress = { pointsTotal: number; pointsDone: number; percent: number; unestimatedTasks: number };

/** Both aggregates are deliberately calculated from one filtered-client read, rather than separate counts. */
export function createDerived(db: DerivedDb) {
  return {
    async progress(projectId: string): Promise<Progress> {
      const tasks = await db.task?.findMany({ where: { projectId }, select: { storyPoints: true, status: true } }) ?? [];
      let pointsTotal = 0;
      let pointsDone = 0;
      let unestimatedTasks = 0;
      for (const task of tasks) {
        if (task.storyPoints == null) { unestimatedTasks++; continue; }
        pointsTotal += task.storyPoints;
        if (task.status === "DONE") pointsDone += task.storyPoints;
      }
      return { pointsTotal, pointsDone, percent: pointsTotal === 0 ? 0 : (pointsDone / pointsTotal) * 100, unestimatedTasks };
    },
    async velocity(projectId: string, n: number): Promise<unknown[]> {
      if (!Number.isInteger(n) || n < 1 || n > 100) throw new RangeError("INVALID_VELOCITY_LIMIT");
      return db.sprint?.findMany({
        where: { projectId, status: "CLOSED", completedPoints: { not: null } },
        orderBy: [{ endDate: "desc" }, { id: "asc" }], take: n,
        select: { id: true, name: true, completedPoints: true },
      }) ?? [];
    },
  };
}

export type Derived = ReturnType<typeof createDerived>;
