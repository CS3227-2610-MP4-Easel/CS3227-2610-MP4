import type { AuthRuntime } from "@agile/auth";
import { registerContextSource, registerCore } from "@agile/ai-context";
import { NotMember } from "@agile/contracts";
import { createCheckpoints, createCore, createCoreResourceResolvers, createEpics, createProjects, createTasks, registerCoreContextSources, resolveCoreResource } from "@agile/core";
import type { AuthDependencies } from "./middleware/auth.js";
import { createW5Routes, type W5RouteServices } from "./routes/index.js";

type Db = AuthRuntime["db"];

export type CoreComposition = Pick<AuthDependencies, "resolveResource" | "requireMember"> & { routes: ReturnType<typeof createW5Routes> };

/** The sole production owner of core, context registration, and W5 transport services. */
export function createCoreComposition(auth: Pick<AuthRuntime, "db" | "lookupUserByEmail" | "lookupUserRole">): CoreComposition {
  // Core's narrow structural ports deliberately accept only the delegates each service uses.
  const db = auth.db as unknown as Record<string, unknown>;
  const core = createCore({ db: db as never });
  // The HTTP policy layer deliberately speaks only the anti-oracle NOT_FOUND sentinel.
  const requireMember: AuthDependencies["requireMember"] = async (userId, projectId) => {
    try { await core.requireMember(userId, projectId); } catch (error) {
      if (error instanceof NotMember) throw new Error("NOT_FOUND");
      throw error;
    }
  };
  const access = { requireMember: core.requireMember, archivedMembership: async () => false };
  const resolvers = createCoreResourceResolvers(db as never);
  const resolveResource: AuthDependencies["resolveResource"] = async (operationId, request) => {
    const resolved = await resolveCoreResource(resolvers, operationId, request);
    if (operationId !== "PROJECT_MEMBER_ADD" || !resolved || resolved.kind === "PROJECT_SET") return resolved;
    const email = request.body && typeof request.body === "object" ? (request.body as { email?: unknown }).email : undefined;
    if (typeof email !== "string") return resolved;
    const user = await auth.lookupUserByEmail(email.trim().toLowerCase());
    const targetRole = user ? await auth.lookupUserRole(user.userId) : null;
    return targetRole ? { ...resolved, targetRole } : resolved;
  };
  const services: W5RouteServices = {
    projects: createProjects(db as never, access),
    checkpoints: createCheckpoints(db as never, access),
    planning: { epics: createEpics(db as never, access), tasks: createTasks(db as never, access) },
  };

  // Registration is intentionally fail-fast: a duplicate or missing source must prevent degraded boot.
  registerCore(core);
  registerCoreContextSources(db as never, registerContextSource);
  return { requireMember, resolveResource, routes: createW5Routes(services) };
}

const compositions = new WeakMap<object, CoreComposition>();

/** API app construction is repeatable in tests without re-registering process-wide context sources. */
export function getCoreComposition(auth: AuthRuntime): CoreComposition {
  const cached = compositions.get(auth);
  if (cached) return cached;
  const composition = createCoreComposition(auth);
  compositions.set(auth, composition);
  return composition;
}
