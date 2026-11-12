// Compile-time only (spec E32): `tsc` checks this file, the tests are not type-checked. Nothing here runs.
import type { AiContext } from "@agile/contracts";
import { createAiContext, getAiContext } from "./assemble.js";

/** Both constructions satisfy the frozen `AiContext` type unchanged (spec N3). */
export const frozenTypeChecks: AiContext[] = [getAiContext(), createAiContext({ core: { requireMember: async () => {} }, sources: new Map() })];

/** Negative control: if this file stopped being type-checked, the unused directive below would not fail, so `tsc` passing proves the checks above are live. */
export const negativeControl = () =>
  // @ts-expect-error the frozen feature type rejects a number
  getAiContext().assemble({ userId: "", role: "PM" }, 1, "");
