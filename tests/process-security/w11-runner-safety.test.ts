import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const runner = readFileSync(new URL("../security/attack-corpus/runner.ts", import.meta.url), "utf8");
const setup = readFileSync(new URL("../security/w11-network-deny.setup.ts", import.meta.url), "utf8");
const corpusTest = readFileSync(new URL("../security/attack-corpus.test.ts", import.meta.url), "utf8");

test("W11 runner has a closed dispatch and no dynamic execution", () => {
  assert.doesNotMatch(runner, /\b(?:eval|Function|import\s*\()/);
  assert.doesNotMatch(runner, /child_process|\bexec(?:File|Sync)?\b|spawn(?:Sync)?\b/);
  assert.doesNotMatch(runner, /\b(?:fetch|axios|got)\s*\(/);
  assert.match(runner, /fixture\.kind === "INPUT_TEXT"/);
  assert.match(runner, /fixture\.kind === "AUTH_REQUEST"/);
});

test("W11 setup installs network and process deny tripwires before the runner", () => {
  for (const primitive of ["node:http", "node:https", "node:net", "node:tls", "node:dns", "node:child_process"]) assert.match(setup, new RegExp(primitive.replace(":", "\\:")));
  assert.match(setup, /globalThis\.fetch/);
  assert.match(setup, /W11_NETWORK_DENY_INSTALLED/);
});

test("W11 protected corpus remains declarative data", () => {
  const cases = readFileSync(new URL("../security/attack-corpus/cases.json", import.meta.url), "utf8");
  assert.ok(cases.trimStart().startsWith("["));
  assert.doesNotMatch(cases, /(^|\n)\s*(?:import|export)\s/);
});

test("W11 limiter and session barriers call production seams", () => {
  assert.match(corpusTest, /import\s+\{\s*createHit\s*\}\s+from .*rate-limit\.js/);
  assert.match(corpusTest, /import\s+\{\s*createLlmGateway\s*\}\s+from .*gateway\.js/);
  assert.match(corpusTest, /import\s+\{\s*createSessions/);
  assert.doesNotMatch(corpusTest, /const reserve =/);
  assert.doesNotMatch(corpusTest, /const openSession =/);
});
