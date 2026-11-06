import assert from "node:assert/strict";
import { test } from "node:test";
import { checkOutput, defaultGuards, fingerprintParts, GUARD_LIMITS, GUARD_VERSION, injectionFlag, rulesFingerprint, sanitiseInput } from "../src/index.js";

/**
 * One entry per GUARD_VERSION. When a rule, limit, template or step order changes, the fingerprint changes and this test fails:
 * bump GUARD_VERSION in `guards.ts` and add a new entry here. Never edit an existing entry.
 */
const KNOWN: Record<string, string> = {
  "1": "5021d942e0e450e2493bd12973d84a230bee0dfdb76e8a606f06f7523155709d",
};

test("F7 the guards are exported from the package", () => {
  assert.equal(typeof sanitiseInput, "function");
  assert.equal(typeof injectionFlag, "function");
  assert.equal(typeof checkOutput, "function");
  assert.equal(typeof rulesFingerprint, "function");
  assert.equal(defaultGuards.output.length, 3, "output takes the call context");
  assert.deepEqual(GUARD_LIMITS, { passCap: 10, d2TagBound: 256, maxDepth: 64, maxStrings: 10_000, minSecretLength: 8, inputCapFactor: 8, boundaryLength: 16, boundaryDraws: 4 });
});

test("E39 N5 the fingerprint changes with every kind of rule data", () => {
  const original = rulesFingerprint();
  const mutate = (change: (parts: ReturnType<typeof fingerprintParts>) => void) => {
    const parts = structuredClone(fingerprintParts());
    change(parts);
    return rulesFingerprint(parts);
  };
  const hashes = [
    mutate((p) => { (p.delimiterRules as Array<{ source: string }>)[0].source += "x"; }),
    mutate((p) => { (p.piiRules as Array<{ flags: string }>)[0].flags = "gu"; }),
    mutate((p) => { (p.piiRules as Array<{ replacement?: string }>)[0].replacement = "[mail]"; }),
    mutate((p) => { (p.limits as { passCap: number }).passCap = 11; }),
    mutate((p) => { p.suffix += " "; }),
    mutate((p) => { (p.steps.output as unknown as string[])[0] = "parse"; }),
  ];
  assert.equal(new Set([original, ...hashes]).size, 7);
});

test("E41 N5 GUARD_VERSION matches the current rules", () => {
  const current = rulesFingerprint();
  assert.equal(
    KNOWN[GUARD_VERSION], current,
    `GUARD_VERSION "${GUARD_VERSION}" does not match the guard rules (fingerprint ${current}). W9's item_summaries key includes GUARD_VERSION, ` +
      "so summaries made under the old rules would be reused: bump GUARD_VERSION and add its KNOWN entry (spec conventions.md § GUARD_VERSION bump checklist).",
  );
});
