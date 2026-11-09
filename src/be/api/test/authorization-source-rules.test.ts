import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const routesDir = join(process.cwd(), "src/be/api/src/routes");
const routeFiles = readdirSync(routesDir).filter((file) => file.endsWith(".ts")).sort();
const sources = routeFiles.map((file) => ({ file, source: readFileSync(join(routesDir, file), "utf8") }));
const handlerSources = sources.filter(({ file }) => file !== "register.ts" && file !== "index.ts" && file !== "health.ts");

test("W11 scans exactly the route-handler source set", () => {
  assert.deepEqual(routeFiles, ["auth.ts", "checkpoints.ts", "health.ts", "index.ts", "planning.ts", "projects.ts", "register.ts"]);
  assert.ok(sources.every(({ file, source }) => file === "index.ts" || source.includes("operationId") || source.includes("policyKey") || source.includes("registerRoute") || source.includes("policyForRoute")));
});

test("W11 route handlers contain no direct role or policy authorization", () => {
  const violations: string[] = [];
  for (const { file, source } of handlerSources) {
    if (/\b(?:principal|actor|user|identity)\s*(?:\?\.)?\s*role\b|\b(?:principal|actor|user|identity)\s*\[\s*["']role["']\s*\]/m.test(source)) violations.push(`${file}: direct role access`);
    if (/\b(?:const|let|var)\s*\{[^}]*\brole\s*(?::|[,}])[^}]*\}\s*=\s*(?:principal|actor|user|identity)\b/m.test(source)) violations.push(`${file}: destructured role access`);
    if (/\bpolicy\s*(?:\?\.)?\s*(?:roles\b|\[\s*["']roles["']\s*\])|\b(?:const|let|var)\s*\{[^}]*\broles\b[^}]*\}\s*=\s*policy\b/m.test(source)) violations.push(`${file}: direct policy-role check`);
    if (/\b(?:policy\s*(?:\?\.)?\s*)?predicate\s*(?:===|!==|==|!=)|\bpolicy\s*\[\s*["']predicate["']\s*\]|\b(?:const|let|var)\s*\{[^}]*\bpredicate\b[^}]*\}\s*=\s*policy\b/m.test(source)) violations.push(`${file}: direct predicate decision`);
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
