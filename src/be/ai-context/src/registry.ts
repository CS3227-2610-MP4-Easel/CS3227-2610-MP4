import type { Core, UserRole } from "@agile/contracts";
import { SOURCE_IDS, type AssembleOptions, type EntityType, type SourceId } from "./allow-list.js";

export type ContextRow = { projectId: string; ref: { type: EntityType; id: string }; ownerId?: string; text: string };
export type SourceArgs = { caller: { userId: string; role: UserRole }; projectId: string; options: Readonly<AssembleOptions>; captured?: unknown };
export type ContextSource = (args: SourceArgs) => Promise<ContextRow[]>;
export type MemberCheck = Pick<Core, "requireMember">;

// Registered at module load, like the gateway's mock registry: role modules register their own sources, and the API
// composition root registers the core and its sources, so W6 imports neither (spec SD5).
export const sourceRegistry = new Map<SourceId, ContextSource>();
export const coreRegistry: { core: MemberCheck | null } = { core: null };

export function registerContextSource(id: SourceId, source: ContextSource): void {
  if (!(SOURCE_IDS as readonly string[]).includes(id)) throw new Error("UNKNOWN_CONTEXT_SOURCE");
  if (typeof source !== "function") throw new Error("INVALID_CONTEXT_SOURCE");
  // A second registration is a load-order bug, never a replacement (spec SD10).
  if (sourceRegistry.has(id)) throw new Error("SOURCE_ALREADY_REGISTERED");
  sourceRegistry.set(id, source);
}

export function registerCore(core: MemberCheck): void {
  if (coreRegistry.core) throw new Error("CORE_ALREADY_REGISTERED");
  coreRegistry.core = core;
}

/** Tests only; exported from `@agile/ai-context/testing`, which scan rule 3 keeps out of production code. */
export function resetContextRegistries(): void {
  sourceRegistry.clear();
  coreRegistry.core = null;
}
