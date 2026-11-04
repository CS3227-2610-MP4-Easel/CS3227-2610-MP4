import type { RouteDefinition } from "@agile/contracts";
import { getAuthRuntime } from "@agile/auth";
import { authRoutes } from "./auth.js";
import { healthRoute } from "./health.js";

/** One line per owner: append your module's `RouteDefinition[]` here; `createApiApp` registers each through the policy gate. */
export const ROUTES: RouteDefinition[] = [healthRoute, ...authRoutes(getAuthRuntime)];
