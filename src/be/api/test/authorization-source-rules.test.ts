import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";

const routesDir = join(process.cwd(), "src/be/api/src/routes");
export const readRouteSources = (directory: string) => readdirSync(directory).filter((file) => file.endsWith(".ts")).sort().map((file) => ({ file, source: readFileSync(join(directory, file), "utf8") }));
const sources = readRouteSources(routesDir);
const handlerSources = sources.filter(({ file }) => file !== "register.ts" && file !== "index.ts" && file !== "health.ts");

test("W11 scans exactly the route-handler source set", () => {
  assert.ok(sources.every(({ file, source }) => file === "index.ts" || source.includes("operationId") || source.includes("policyKey") || source.includes("registerRoute") || source.includes("policyForRoute")));
});

test("W11 discovers a new route file without an allow-list update", () => {
  const directory = mkdtempSync(join(tmpdir(), "w11-routes-"));
  try {
    writeFileSync(join(directory, "sprints.ts"), "export const operationId = 'SPRINT_LIST';");
    assert.deepEqual(readRouteSources(directory).map(({ file }) => file), ["sprints.ts"]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("W11 route handlers contain no direct role or policy authorization", () => {
  const violations: string[] = [];
  for (const { file, source } of handlerSources) {
    const principals = new Set(["principal", "actor", "user", "identity"]);
    const policies = new Set(["policy"]);
    for (let pass = 0; pass < 3; pass++) {
      for (const match of source.matchAll(/\b(?:const|let|var)\s+(\w+)\s*=\s*(\w+)\b/g)) {
        if (principals.has(match[2])) principals.add(match[1]);
        if (policies.has(match[2])) policies.add(match[1]);
      }
    }
    const names = (values: Set<string>) => [...values].map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
    const principalNames = names(principals);
    const policyNames = names(policies);
    if (new RegExp(`\\b(?:${principalNames})\\s*(?:\\?\\.)?\\s*role\\b|\\b(?:${principalNames})\\s*\\[\\s*["']role["']\\s*\\]`, "m").test(source)) violations.push(`${file}: direct role access`);
    if (new RegExp(`\\b(?:const|let|var)\\s*\\{[^}]*\\brole\\s*(?::|[,}])[^}]*\\}\\s*=\\s*(?:${principalNames})\\b`, "m").test(source)) violations.push(`${file}: destructured role access`);
    if (new RegExp(`\\b(?:${policyNames})\\s*(?:\\?\\.)?\\s*(?:roles\\b|\\[\\s*["']roles["']\\s*\\])`, "m").test(source) || new RegExp(`\\b(?:const|let|var)\\s*\\{[^}]*\\broles\\b[^}]*\\}\\s*=\\s*(?:${policyNames})\\b`, "m").test(source)) violations.push(`${file}: direct policy-role check`);
    if (new RegExp(`\\b(?:${policyNames})\\s*(?:\\?\\.)?\\s*predicate\\s*(?:===|!==|==|!=)|\\b(?:${policyNames})\\s*\\[\\s*["']predicate["']\\s*\\]`, "m").test(source) || new RegExp(`\\b(?:const|let|var)\\s*\\{[^}]*\\bpredicate\\b[^}]*\\}\\s*=\\s*(?:${policyNames})\\b`, "m").test(source)) violations.push(`${file}: direct predicate decision`);
  }
  assert.deepEqual(violations, []);
});

test("W11 keeps authorization at the registration boundary and protects sensitive paths", () => {
  const register = sources.find(({ file }) => file === "register.ts")?.source ?? "";
  assert.match(register, /authorizeRequest\(/);
  assert.match(register, /authorizeAdder\(/);
  assert.match(register, /policyForRoute\(/);
  assert.match(register, /parseJsonBody\(/);
  assert.equal(sources.filter(({ source }) => source.includes("authorizeRequest(")).map(({ file }) => file).join(","), "register.ts");
  assert.equal(sources.filter(({ source }) => source.includes("authorizeAdder(")).map(({ file }) => file).join(","), "register.ts");
});
