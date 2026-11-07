import type { RouteDefinition } from "@agile/contracts";
import { getAuthRuntime } from "@agile/auth";
import { getPmRuntime } from "@agile/pm";
import { authRoutes } from "./auth.js";
import { healthRoute } from "./health.js";
import { pmRoutes } from "./pm.js";

/** One line per owner: append your module's `RouteDefinition[]` here; `createApiApp` registers each through the policy gate. */
export const ROUTES: RouteDefinition[] = [healthRoute, ...authRoutes(getAuthRuntime), ...pmRoutes(getPmRuntime)];
