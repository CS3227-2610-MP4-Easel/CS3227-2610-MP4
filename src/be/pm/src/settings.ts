export type PmSettings = { similarItems: boolean };

/** `PM_SIMILAR_ITEMS` is `on` (default) or `off`; anything else fails at startup, without echoing the value. */
export function loadPmSettings(env: Record<string, string | undefined>): PmSettings {
  const raw = env.PM_SIMILAR_ITEMS;
  if (raw === undefined) return { similarItems: true };
  if (raw === "on") return { similarItems: true };
  if (raw === "off") return { similarItems: false };
  throw new Error("INVALID_SETTING:PM_SIMILAR_ITEMS");
}
