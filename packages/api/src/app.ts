import { Hono } from "hono";
import { errorResponse } from "./errors.js";
import { requestIdMiddleware } from "./middleware/request-id.js";
import { healthRoute } from "./routes/health.js";

type ApiEnv = { Variables: { requestId: string } };

export function createApiApp() {
  const app = new Hono<ApiEnv>();
  app.use("*", requestIdMiddleware);
  app.onError((error, c) => errorResponse(error, c.get("requestId")));
  app.get("/api/health", healthRoute);
  return app;
}

export const apiApp = createApiApp();
