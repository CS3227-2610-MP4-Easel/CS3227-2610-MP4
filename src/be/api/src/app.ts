import { Hono } from "hono";
import { errorResponse, HttpError } from "./errors.js";
import { requestIdMiddleware } from "./middleware/request-id.js";
import { getAuthRuntime } from "@agile/auth";
import { createAppDependencies } from "./deps.js";
import type { AuthDependencies } from "./middleware/auth.js";
import { ROUTES } from "./routes/index.js";
import { registerRoute, type ApiEnv } from "./routes/register.js";

/** With no `deps`, wires the process-wide auth runtime, which validates auth settings and fails startup on unsafe ones. */
export function createApiApp(deps: AuthDependencies = createAppDependencies(getAuthRuntime())) {
  const app = new Hono<ApiEnv>();
  app.use("*", requestIdMiddleware);
  app.onError((error, c) => {
    const response = errorResponse(error, c.get("requestId"));
    if (response.status >= 500) console.error("API request failed", { requestId: c.get("requestId"), errorType: error.name });
    return response;
  });
  for (const route of ROUTES) registerRoute(app, route, deps);
  app.notFound((c) => errorResponse(new HttpError("NOT_FOUND", 404, "The requested resource was not found."), c.get("requestId")));
  return app;
}

export const apiApp = createApiApp();
