import type { RouteDefinition } from "@agile/contracts";
import { getAuthRuntime } from "@agile/auth";
import { getPmRuntime } from "@agile/pm";
import { authRoutes } from "./auth.js";
import { healthRoute } from "./health.js";
import { pmRoutes } from "./pm.js";
import { createProjectsRoutes, type ProjectsRouteServices } from "./projects.js";
import { createCheckpointsRoutes, type CheckpointsRouteServices } from "./checkpoints.js";
import { createPlanningRoutes, type PlanningRouteServices } from "./planning.js";

/** One line per owner: append your module's `RouteDefinition[]` here; `createApiApp` registers each through the policy gate. */
export const ROUTES: RouteDefinition[] = [healthRoute, ...authRoutes(getAuthRuntime), ...pmRoutes(getPmRuntime)];

export type W5RouteServices = { projects: ProjectsRouteServices; checkpoints: CheckpointsRouteServices; planning: PlanningRouteServices };

/** Tier 1 W5 factories remain transport-only; composition supplies their narrow service objects. */
export function createW5Routes(services: W5RouteServices): RouteDefinition[] {
  return [...createProjectsRoutes(services.projects), ...createCheckpointsRoutes(services.checkpoints), ...createPlanningRoutes(services.planning)];
}
