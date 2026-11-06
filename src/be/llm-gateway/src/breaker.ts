import type { PrismaClient } from "@prisma/client";
import { LIMITS } from "./config.js";
import type { Clock } from "./clock.js";

type BreakerState = { failures: number; openUntil: string | null };
type Deps = { db: PrismaClient; clock: Clock; key: string };

async function read({ db, key }: Deps): Promise<BreakerState> {
  const value = (await db.llmGatewayState.findUnique({ where: { key } }))?.value as Partial<BreakerState> | undefined;
  return { failures: typeof value?.failures === "number" ? value.failures : 0, openUntil: typeof value?.openUntil === "string" ? value.openUntil : null };
}

async function write({ db, key }: Deps, value: BreakerState): Promise<void> {
  await db.llmGatewayState.upsert({ where: { key }, create: { key, value }, update: { value } });
}

/** Closed admits; open refuses until `openUntil`; after it, this call is the probe and re-arms `openUntil` before calling the provider. */
export async function admitBreaker(deps: Deps): Promise<boolean> {
  const state = await read(deps);
  if (state.openUntil === null) return true;
  const now = deps.clock.now();
  if (new Date(state.openUntil) > now) return false;
  await write(deps, { ...state, openUntil: new Date(now.getTime() + LIMITS.breakerOpenMs).toISOString() });
  return true;
}

/** Upstream failures (5xx, network, timeout) count once per call; `OK` closes; anything user-attributable leaves the state (A-12).
 * Read then write without a lock: a lost increment or an extra probe is accepted (spec SD13). */
export async function recordOutcome(deps: Deps, status: string): Promise<void> {
  if (status === "OK") {
    const state = await read(deps);
    if (state.failures !== 0 || state.openUntil !== null) await write(deps, { failures: 0, openUntil: null });
    return;
  }
  if (status !== "UPSTREAM_ERROR" && status !== "TIMEOUT") return;
  const state = await read(deps);
  const failures = state.failures + 1;
  if (failures < LIMITS.breakerFailures) return write(deps, { ...state, failures });
  await write(deps, { failures, openUntil: new Date(deps.clock.now().getTime() + LIMITS.breakerOpenMs).toISOString() });
  console.warn("llm_breaker_open", { failures });
}
