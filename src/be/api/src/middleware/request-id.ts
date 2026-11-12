import type { Context, Next } from "hono";

export async function requestIdMiddleware(c: Context, next: Next) {
  const requestId = crypto.randomUUID();
  c.set("requestId", requestId);
  await next();
  c.header("X-Request-Id", requestId);
}
