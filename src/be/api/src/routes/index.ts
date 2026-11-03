import type { RouteDefinition } from "@agile/contracts";
import { healthRoute } from "./health.js";

/** One line per owner: append your module's `RouteDefinition[]` here; `createApiApp` registers each through the policy gate. */
export const ROUTES: RouteDefinition[] = [healthRoute];
