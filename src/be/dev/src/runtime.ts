import { randomBytes } from "node:crypto";
import type { FilteredDbClient } from "@agile/db";
import type { LlmGateway, Standup } from "@agile/contracts";
import { getAiContext, type AiContextWith } from "@agile/ai-context";
import { GUARD_VERSION, checkOutput, getLlmGateway, getSessions, recordCacheHit as defaultRecordCacheHit, sanitiseInput, type CacheHitInput, type GatewaySessions } from "./gateway-binding.js";
import { registerDevMocks } from "./ai/mocks.js";
import { SUMMARY_PROMPT_VERSION } from "./ai/prompts.js";
import { generateStandup } from "./flows/standups.js";
import { generateSummaries } from "./flows/summaries.js";
import { uploadItems } from "./store/items.js";
import { createDevResolvers } from "./store/resolvers.js";
import { registerDevContextSources } from "./store/sources.js";
import { developerIds, findStandup, listLeadStandups, toStandup } from "./store/standups.js";
import type { DevWriteDeps } from "./store/writable.js";

type Member = { userId: string; role: string };
type Caller = { userId: string; role: "DEVELOPER" };
type Actor = { userId: string; role: "PM" | "DEV_LEAD" | "DEVELOPER" };
export type DevRuntimeDeps = {
  db: FilteredDbClient;
  requireMember(userId: string, projectId: string): Promise<void>;
  members(actor: Actor, projectId: string): Promise<Member[]>;
  lookupArchivedMembership(userId: string, projectId: string): Promise<boolean>;
  now?: () => Date;
  overrides?: Partial<{ gateway: LlmGateway; sessions: GatewaySessions; ai: Pick<AiContextWith, "assembleWith">; recordCacheHit(input: CacheHitInput): Promise<void> }>;
};

export function createDevRuntime(deps: DevRuntimeDeps) {
  const now = deps.now ?? (() => new Date());
  const key = { guardVersion: GUARD_VERSION, promptVersion: SUMMARY_PROMPT_VERSION };
  registerDevMocks();
  registerDevContextSources(deps.db, key);
  const write = { db: deps.db, requireMember: deps.requireMember } as unknown as DevWriteDeps;
  const sanitiseFlag = (text: string) => sanitiseInput(text).flagged;
  const checkLine = (line: string) => checkOutput(line, { kind: "text", maxChars: 300 }, { boundary: randomBytes(8).toString("hex"), secrets: [] }).ok;
  const resolvers = createDevResolvers({ db: deps.db, lookupArchivedMembership: deps.lookupArchivedMembership, requireMember: deps.requireMember });
  // Gateway values are read per request: the preview runtime throws when they are touched.
  const gateway = () => deps.overrides?.gateway ?? getLlmGateway();
  const sessions = () => deps.overrides?.sessions ?? getSessions();
  const ai = () => deps.overrides?.ai ?? getAiContext();
  const recordCacheHit = (input: CacheHitInput) => (deps.overrides?.recordCacheHit ?? defaultRecordCacheHit)(input);
  return {
    now,
    resolvers,
    upload: (userId: string, projectId: string, items: unknown[]) => uploadItems({ ...write, sanitiseFlag, currentKey: key, now }, userId, projectId, items),
    summaries: (caller: Caller, projectId: string, itemIds: string[]) => {
      const s = sessions();
      return generateSummaries({ db: deps.db, write, key, now, ai: ai(), gateway: gateway(), sessions: { openOrReuse: (i) => s.openOrReuse(i) }, recordCacheHit, sanitiseFlag }, caller, projectId, itemIds);
    },
    standup: (caller: Caller, projectId: string, date: string | undefined) => {
      const s = sessions();
      return generateStandup({ db: deps.db, write, now, ai: ai(), gateway: gateway(), sessions: { open: (i) => s.open(i), regenerate: (id, userId) => s.regenerate(id, userId) }, recordCacheHit, sanitiseFlag, checkLine }, caller, projectId, date);
    },
    mine: async (userId: string, projectId: string, date: string): Promise<Standup> => {
      const row = await findStandup(deps.db, projectId, userId, date);
      if (!row) throw new Error("NOT_FOUND");
      return toStandup(row, false);
    },
    leadList: async (actor: Actor, projectId: string, q: { date?: string; developerId?: string; page: number; size: number }) =>
      listLeadStandups(deps.db, projectId, developerIds(await deps.members(actor, projectId)), q),
  };
}

export type DevRuntime = ReturnType<typeof createDevRuntime>;
