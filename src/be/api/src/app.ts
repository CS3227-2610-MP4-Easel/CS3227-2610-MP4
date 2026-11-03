import { Hono } from "hono";
import { errorResponse, HttpError } from "./errors.js";
import { requestIdMiddleware } from "./middleware/request-id.js";
import { healthRoute } from "./routes/health.js";

type ApiEnv = { Variables: { requestId: string } };

export function createApiApp() {
  const app = new Hono<ApiEnv>();
  app.use("*", requestIdMiddleware);
  app.onError((error, c) => {
    const response = errorResponse(error, c.get("requestId"));
    if (response.status >= 500) console.error("API request failed", { requestId: c.get("requestId"), errorType: error.name });
    return response;
  });
  app.get("/api/health", healthRoute);
  app.notFound((c) => errorResponse(new HttpError("NOT_FOUND", 404, "The requested resource was not found."), c.get("requestId")));
  return app;
}

export const apiApp = createApiApp();
