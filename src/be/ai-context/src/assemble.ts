import { z } from "zod";
import { NotMember, type AiContext, type ContextSections, type Feature, type UserRole } from "@agile/contracts";
import { ALLOW_LIST, ENTITY_TYPES, FACT_KEYS, FACT_VALUE_PATTERNS, FEATURE_ROLES, OPTION_SCHEMAS, type AssembleOptions, type EntityType, type SectionSpec, type SourceId } from "./allow-list.js";
import { ContextScopeViolation } from "./errors.js";
import { coreRegistry, sourceRegistry, type ContextSource, type MemberCheck, type SourceArgs } from "./registry.js";

export type Provenance = { section: string; type: EntityType; id: string; projectId: string }[];
export type AssembleResult = { sections: ContextSections; provenance: Provenance };
type Caller = { userId: string; role: UserRole };
/** The frozen `AiContext` plus `assembleWith`, which carries per-feature options and returns provenance (spec SD4). */
export type AiContextWith = AiContext & {
  assembleWith(caller: Caller, feature: Feature, targetProjectId: string, options: AssembleOptions): Promise<AssembleResult>;
};

const DEFAULT_SOURCE_TIMEOUT_MS = 10_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const InputSchema = z.object({
  caller: z.object({ userId: z.string().regex(UUID), role: z.enum(["PM", "DEV_LEAD", "DEVELOPER"]) }),
  feature: z.enum(Object.keys(FEATURE_ROLES) as [Feature, ...Feature[]]),
  targetProjectId: z.string().regex(UUID),
});

/** A row as checked: plain strings read once, so a getter or a later change cannot alter what reaches the prompt (spec SD13). */
type Snapshot = Readonly<{ projectId: string; type: string; id: string; ownerId: string | undefined; text: string }>;

function snapshot(value: unknown): Snapshot | null {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    const { projectId, ref, ownerId, text } = value as Record<string, unknown>;
    if (typeof ref !== "object" || ref === null) return null;
    const { type, id } = ref as Record<string, unknown>;
    if (typeof projectId !== "string" || typeof type !== "string" || typeof id !== "string" || typeof text !== "string") return null;
    if (ownerId !== undefined && typeof ownerId !== "string") return null;
    return Object.freeze({ projectId, type, id, ownerId, text });
  } catch {
    return null;
  }
}

function validShape(row: Snapshot): boolean {
  return UUID.test(row.projectId) && (ENTITY_TYPES as readonly string[]).includes(row.type) && row.id.length >= 1 && row.id.length <= 64
    && (row.ownerId === undefined || UUID.test(row.ownerId)) && row.text.length > 0 && !/\p{Cs}/u.test(row.text);
}

function validFact(text: string): boolean {
  const at = text.indexOf("=");
  const key = text.slice(0, at);
  const value = text.slice(at + 1);
  if (at < 1 || !Object.hasOwn(FACT_KEYS, key)) return false;
  return value === "null" || FACT_VALUE_PATTERNS[FACT_KEYS[key]].test(value);
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const inner of Object.values(value)) deepFreeze(inner);
  }
  return value;
}

/** A source that has not settled by the deadline counts as failed; a late rejection is still handled by the race. */
function withDeadline<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("DEADLINE")), ms); });
  return Promise.race([work, deadline]).finally(() => clearTimeout(timer));
}

/** `instanceof` on a hostile value (a Proxy whose prototype lookup throws) must not leak that value's own error. */
function isNotMember(error: unknown): boolean {
  try {
    return error instanceof NotMember;
  } catch {
    return false;
  }
}

/** Membership through the core: a fresh `NotMember` (never the core's own object), anything else a fixed code. */
async function requireMember(core: MemberCheck, userId: string, projectId: string): Promise<void> {
  try {
    await core.requireMember(userId, projectId);
  } catch (error) {
    throw isNotMember(error) ? new NotMember() : new Error("CORE_FAILED");
  }
}

/** The source's rows as snapshots, reading at most `maxRows + 1` entries so a huge or hostile array cannot spin or throw. */
function readRows(value: unknown, maxRows: number): { snaps: (Snapshot | null)[]; tooMany: boolean } | null {
  try {
    if (!Array.isArray(value)) return null;
    const length = value.length;
    const take = Math.min(length, maxRows + 1);
    const snaps: (Snapshot | null)[] = [];
    for (let i = 0; i < take; i++) snaps.push(snapshot(value[i]));
    return { snaps, tooMany: length > maxRows };
  } catch {
    return null;
  }
}

function violation(sourceId: SourceId, check: string): never {
  console.warn("context_scope_violation", { sourceId, check });
  throw new ContextScopeViolation(sourceId, check);
}

type CheckContext = { core: MemberCheck; caller: Caller; targetProjectId: string; options: AssembleOptions };

/** Spec api.md § Row checks, check-major: each check runs over all rows before the next. */
async function checkSection(spec: SectionSpec, value: unknown, ctx: CheckContext): Promise<Snapshot[]> {
  const fail = (check: string) => violation(spec.sourceId, check);
  const read = readRows(value, spec.maxRows);
  if (!read || read.snaps.some((row) => row === null || !validShape(row))) return fail("shape");
  if (read.tooMany) fail("count");
  const snaps = read.snaps as Snapshot[];
  if (snaps.some((row) => !(spec.types as string[]).includes(row.type))) fail("type");
  if (snaps.some((row) => [...row.text].length > spec.maxChars)) fail("length");
  if (spec.scope.includes("format") && snaps.some((row) => !validFact(row.text))) fail("format");
  if (spec.scope.includes("target") && snaps.some((row) => row.projectId !== ctx.targetProjectId)) fail("project");
  if (spec.scope.includes("own") && snaps.some((row) => row.ownerId?.toLowerCase() !== ctx.caller.userId.toLowerCase())) fail("owner");
  if (spec.scope.includes("requested")) {
    const ids = snaps.map((row) => row.id);
    if (ids.some((id) => !ctx.options.itemIds?.includes(id)) || new Set(ids).size !== ids.length) fail("requested");
  }
  if (spec.scope.includes("member")) await checkOtherProjects(spec, snaps, ctx);
  return snaps;
}

/** Membership of every non-target project a cross-project section draws from, once per project. */
async function checkOtherProjects(spec: SectionSpec, snaps: Snapshot[], ctx: CheckContext): Promise<void> {
  const others = [...new Set(snaps.map((row) => row.projectId))].filter((projectId) => projectId !== ctx.targetProjectId);
  for (const projectId of others) {
    try {
      await ctx.core.requireMember(ctx.caller.userId, projectId);
    } catch (error) {
      if (isNotMember(error)) violation(spec.sourceId, "membership");
      throw new Error("CORE_FAILED");
    }
  }
}

function makeContext(getCore: () => MemberCheck | null, getSource: (id: SourceId) => ContextSource | undefined, sourceTimeoutMs: number): AiContextWith {
  async function assembleWith(caller: Caller, feature: Feature, targetProjectId: string, options: AssembleOptions): Promise<AssembleResult> {
    // 1 input; 2 role; 3 core; 4 membership; 5 sources registered (spec api.md § assembleWith).
    const input = InputSchema.safeParse({ caller, feature, targetProjectId });
    const parsedOptions = input.success ? OPTION_SCHEMAS[input.data.feature].safeParse(options) : undefined;
    if (!input.success || !parsedOptions?.success) throw new RangeError("INVALID_ASSEMBLE_INPUT");
    const validCaller = input.data.caller;
    if (FEATURE_ROLES[feature] !== validCaller.role) throw new Error("ROLE_DENIED");
    const core = getCore();
    if (!core) throw new Error("CORE_NOT_REGISTERED");
    await requireMember(core, validCaller.userId, targetProjectId);
    const specs = ALLOW_LIST[feature];
    const sources = specs.map((spec) => getSource(spec.sourceId));
    const missing = specs.findIndex((_, i) => !sources[i]);
    if (missing >= 0) throw new Error(`CONTEXT_SOURCE_MISSING:${specs[missing].sourceId}`);

    // 6 every source at once, each with its own frozen copies, behind a deadline; an async wrapper turns a synchronous
    // throw into a settled rejection so the ordering below still holds.
    const validOptions = parsedOptions.data as AssembleOptions;
    const argsFor = (): SourceArgs => ({ caller: Object.freeze({ ...validCaller }), projectId: targetProjectId, options: deepFreeze(structuredClone(validOptions)) });
    const settled = await Promise.allSettled(sources.map((source) => withDeadline((async () => (source as ContextSource)(argsFor()))(), sourceTimeoutMs)));

    // 7 sections in allow-list order: the first failing section wins, whether it rejected or broke a check.
    const checkContext: CheckContext = { core, caller: validCaller, targetProjectId, options: validOptions };
    const checked: Snapshot[][] = [];
    for (const [i, spec] of specs.entries()) {
      const result = settled[i];
      if (result.status === "rejected") throw isNotMember(result.reason) ? new NotMember() : new Error(`CONTEXT_SOURCE_FAILED:${spec.sourceId}`);
      checked.push(await checkSection(spec, result.value, checkContext));
    }

    // 8 membership again, in case it changed while the sources read or the checks ran: the target and every other
    // project a section draws from; 9 build from the snapshots only.
    await requireMember(core, validCaller.userId, targetProjectId);
    for (const [i, spec] of specs.entries()) if (spec.scope.includes("member")) await checkOtherProjects(spec, checked[i], checkContext);
    const sections: ContextSections = [];
    const provenance: Provenance = [];
    for (const [i, spec] of specs.entries()) {
      if (checked[i].length === 0) continue;
      sections.push({ name: spec.name, kind: spec.kind, priority: spec.priority, budgetTokens: spec.budgetTokens, text: checked[i].map((row) => row.text).join("\n"), trusted: spec.trusted });
      for (const row of checked[i]) provenance.push({ section: spec.name, type: row.type as EntityType, id: row.id, projectId: row.projectId });
    }
    return { sections, provenance };
  }

  return {
    assembleWith,
    async assemble(caller, feature, targetProjectId) {
      return (await assembleWith(caller, feature, targetProjectId, {})).sections;
    },
  };
}

/** The production context: reads both registries at call time, so a source registered after this call is still used. */
export function getAiContext(): AiContextWith {
  return makeContext(() => coreRegistry.core, (id) => sourceRegistry.get(id), DEFAULT_SOURCE_TIMEOUT_MS);
}

/** Tests and wiring only (exported from `@agile/ai-context/testing`): the given core and a copy of the given sources. */
export function createAiContext(deps: { core: MemberCheck; sources: ReadonlyMap<SourceId, ContextSource>; sourceTimeoutMs?: number }): AiContextWith {
  const sources = new Map(deps.sources);
  return makeContext(() => deps.core, (id) => sources.get(id), deps.sourceTimeoutMs ?? DEFAULT_SOURCE_TIMEOUT_MS);
}
