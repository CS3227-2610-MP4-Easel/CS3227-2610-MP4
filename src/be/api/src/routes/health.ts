import type { RouteDefinition } from "@agile/contracts";

export const healthRoute: RouteDefinition = {
  operationId: "HEALTH_READ", method: "GET", path: "/api/health", policyKey: "endpoint-1", responseSchema: {},
  handler: async () => Response.json({ status: "UP" }, { status: 200 }),
};
