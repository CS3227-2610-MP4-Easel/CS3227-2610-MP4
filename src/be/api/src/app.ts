import { Hono } from "hono";
import type { RouteDefinition } from "@agile/contracts";
import { errorResponse, HttpError } from "./errors.js";
import { requestIdMiddleware } from "./middleware/request-id.js";
import { getAuthRuntime } from "@agile/auth";
import { createAppDependencies } from "./deps.js";
import { getCoreComposition } from "./core-composition.js";
import { getDevComposition, withDevComposition } from "./dev-composition.js";
import type { AuthDependencies } from "./middleware/auth.js";
import { ROUTES } from "./routes/index.js";
import { registerRoute, type ApiEnv } from "./routes/register.js";

/** With no `deps`, wires the process-wide auth runtime, which validates auth settings and fails startup on unsafe ones.
 * `routes` defaults to `ROUTES`; tests pass a subset wired to a fake runtime. */
export function createApiApp(deps?: AuthDependencies, routes?: readonly RouteDefinition[]) {
  if (!deps) {
    const auth = getAuthRuntime();
    // Configuration-free previews deliberately have no Firebase or database client.  They still
    // build the public API shell, while protected W5 routes remain fail-closed until a configured
    // tier constructs the database-backed composition.
    if (auth.settings.firebaseProjectId === null) {
      deps = createAppDependencies(auth);
      routes ??= ROUTES;
    } else {
      const composition = withDevComposition(getCoreComposition(auth), getDevComposition(auth));
      deps = createAppDependencies(auth, composition);
      routes ??= [...ROUTES, ...composition.routes];
    }
  }
  routes ??= ROUTES;
  const app = new Hono<ApiEnv>();
  app.use("*", requestIdMiddleware);
  app.onError((error, c) => {
    const response = errorResponse(error, c.get("requestId"));
    if (response.status >= 500) console.error("API request failed", { requestId: c.get("requestId"), errorType: error.name });
    return response;
  });
  for (const route of routes) registerRoute(app, route, deps);
  app.notFound((c) => errorResponse(new HttpError("NOT_FOUND", 404, "The requested resource was not found."), c.get("requestId")));
  return app;
}

let cachedApiApp: ReturnType<typeof createApiApp> | undefined;

/** Build the process-wide API only when the first request needs it.
 * This keeps framework build-time route collection free of runtime credential validation. */
export function getApiApp() {
  return (cachedApiApp ??= createApiApp());
}
