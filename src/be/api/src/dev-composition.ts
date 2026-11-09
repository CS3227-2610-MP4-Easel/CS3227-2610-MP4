import type { AuthRuntime } from "@agile/auth";
import type { RouteDefinition } from "@agile/contracts";
import { createCore, createProjects } from "@agile/core";
import { createDevRuntime } from "@agile/dev";
import type { CoreComposition } from "./core-composition.js";
import { createDevRoutes } from "./routes/index.js";

export type DevComposition = { resolvers: ReturnType<typeof createDevRuntime>["resolvers"]; routes: RouteDefinition[] };

// Registers process-wide context sources: call once per auth runtime (tests reset the registry first).
export function createDevComposition(auth: Pick<AuthRuntime, "db" | "lookupArchivedMembership">): DevComposition {
  const db = auth.db as unknown as Record<string, unknown>;
  const core = createCore({ db: db as never, archivedMembership: auth.lookupArchivedMembership });
  const projects = createProjects(db as never, { requireMember: core.requireMember, archivedMembership: auth.lookupArchivedMembership });
  const runtime = createDevRuntime({ db: auth.db, requireMember: core.requireMember, members: projects.members as never, lookupArchivedMembership: auth.lookupArchivedMembership });
  return { resolvers: runtime.resolvers, routes: createDevRoutes(runtime) };
}

const compositions = new WeakMap<object, DevComposition>();

export function getDevComposition(auth: AuthRuntime): DevComposition {
  const cached = compositions.get(auth);
  if (cached) return cached;
  const composition = createDevComposition(auth);
  compositions.set(auth, composition);
  return composition;
}

export function withDevComposition(core: CoreComposition, dev: DevComposition): CoreComposition {
  return {
    requireMember: core.requireMember,
    resolveResource: (operationId, request, tx) => Object.hasOwn(dev.resolvers, operationId) ? dev.resolvers[operationId](request) : core.resolveResource(operationId, request, tx),
    routes: [...core.routes, ...dev.routes],
  };
}
