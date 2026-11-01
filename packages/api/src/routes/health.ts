import type { Context } from "hono";

export function healthRoute(c: Context) { return c.json({ status: "UP" }, 200); }
