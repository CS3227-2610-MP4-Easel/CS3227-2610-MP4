import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join, posix, relative, sep } from "node:path";
import { test } from "node:test";
import ts from "typescript";

// The AD-25 / A-08 source scan (spec conventions.md § Source-scan rule). A pure function over path -> content, so the
// fixtures below are inline strings and the repository scan never reads them.
type Finding = { file: string; line: number; rule: 1 | 2 | 3 | 4 };
type Import = { spec: string; line: number };

// Scan starts: production sources only (no `test` directory). The map may also hold test and non-src files, which are
// followed when a scanned file imports them, so moving a query into `../lib` or `./test` does not hide it.
const BE_SRC = /^src\/be\/[^/]+\/src\//;
const production = (path: string) => (BE_SRC.test(path) || path.startsWith("src/fe/")) && !path.split("/").includes("test");
// Only the API composition root may assemble gateway-backed services; feature/data packages remain bounded.
const ruleOneFile = (path: string) => production(path) && BE_SRC.test(path) && !/^src\/be\/(db|llm-gateway|proposals|ai-context)\//.test(path) && path !== "src/be/api/src/core-composition.ts";
const ruleTwoFile = (path: string) => production(path) && !path.startsWith("src/be/db/src/");
const ruleThreeFile = (path: string) => production(path) && !/^src\/be\/(api|ai-context)\/src\//.test(path);
const ALLOWED_IN_GATEWAY_FILES = new Set(["@agile/contracts", "@agile/ai-context", "@agile/llm-gateway"]);
const GATEWAY = "@agile/llm-gateway";
const lineAt = (text: string, index: number) => text.slice(0, index).split("\n").length;

/** Every import, re-export, `import()` and `require()` with a literal specifier, type-only ones included. */
function importsOf(content: string): Import[] {
  return ts.preProcessFile(content, true, true).importedFiles.map((f) => ({ spec: f.fileName, line: lineAt(content, f.pos) }));
}

/** Rule 4 from the parsed source (not regexes): an `import()` or `require()` whose argument is not one plain string literal. */
function computedImports(path: string, content: string): number[] {
  const source = ts.createSourceFile(path, content, ts.ScriptTarget.Latest, true, /\.(tsx)$/.test(path) ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const lines: number[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === "require"))) {
      const first = node.arguments[0];
      if (!first || !(ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first))) lines.push(source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return lines;
}

/** A relative specifier resolved the way NodeNext resolves it: "./data.js" may be "./data.ts". */
function resolve(files: Map<string, string>, from: string, spec: string): string | undefined {
  const base = posix.join(posix.dirname(from), spec);
  const stem = base.replace(/\.(m|c)?js$/, "");
  return [base, `${stem}.ts`, `${stem}.tsx`, `${stem}.mts`, `${stem}.cts`, `${stem}.js`, `${stem}.mjs`, `${base}/index.ts`].find((p) => files.has(p));
}

function scan(files: Map<string, string>): { filesScanned: number; findings: Finding[] } {
  const findings = new Map<string, Finding>();
  const add = (finding: Finding) => findings.set(`${finding.file}:${finding.line}:${finding.rule}`, finding);
  let filesScanned = 0;
  for (const [path, content] of files) {
    if (!ruleOneFile(path) && !ruleTwoFile(path) && !ruleThreeFile(path)) continue;
    filesScanned++;
    const imports = importsOf(content);
    if (ruleTwoFile(path)) content.split("\n").forEach((text, i) => { if (/\$(queryRaw|executeRaw)Unsafe\b/.test(text)) add({ file: path, line: i + 1, rule: 2 }); });
    // Rule 3: no ai-context internals (the testing subpath, deep subpaths, or relative paths into the package) outside the composition root.
    if (ruleThreeFile(path)) {
      for (const i of imports) {
        const intoAiContext = i.spec.startsWith("@agile/ai-context/") || (i.spec.startsWith(".") && posix.join(posix.dirname(path), i.spec).startsWith("src/be/ai-context/"));
        if (intoAiContext) add({ file: path, line: i.line, rule: 3 });
      }
    }
    if (!ruleOneFile(path) || !imports.some((i) => i.spec === GATEWAY || i.spec.startsWith(`${GATEWAY}/`))) continue;

    // Rules 1 and 4: this file and everything it reaches through relative imports may use only the allowed workspace
    // packages and no computed imports; a relative import that cannot be resolved fails closed.
    const seen = new Set<string>();
    const queue = [path];
    while (queue.length > 0) {
      const current = queue.pop() as string;
      if (seen.has(current)) continue;
      seen.add(current);
      for (const line of computedImports(current, files.get(current) ?? "")) add({ file: current, line, rule: 4 });
      for (const i of importsOf(files.get(current) ?? "")) {
        if (i.spec.startsWith(".")) {
          const next = resolve(files, current, i.spec);
          if (next) queue.push(next);
          else add({ file: current, line: i.line, rule: 1 });
          continue;
        }
        const pkg = i.spec.split("/").slice(0, 2).join("/");
        if ((pkg.startsWith("@agile/") && !ALLOWED_IN_GATEWAY_FILES.has(pkg)) || pkg.startsWith("@prisma/")) add({ file: current, line: i.line, rule: 1 });
      }
    }
  }
  return { filesScanned, findings: [...findings.values()] };
}

const GW = 'import { getLlmGateway } from "@agile/llm-gateway";\n';
const findingsOf = (files: Record<string, string>) => scan(new Map(Object.entries(files))).findings;

const reported: Array<[string, Record<string, string>, Finding]> = [
  ["gateway and @agile/db in one file", { "src/be/dev/src/ai.ts": `${GW}import { db } from "@agile/db";\n` }, { file: "src/be/dev/src/ai.ts", line: 2, rule: 1 }],
  ["gateway and @prisma/client", { "src/be/dev/src/ai.ts": `${GW}import { PrismaClient } from "@prisma/client";\n` }, { file: "src/be/dev/src/ai.ts", line: 2, rule: 1 }],
  ["gateway and another workspace data package", { "src/be/dev/src/ai.ts": `${GW}import { tasks } from "@agile/core";\n` }, { file: "src/be/dev/src/ai.ts", line: 2, rule: 1 }],
  ["gateway file reaching @agile/db through a relative import", {
    "src/be/dev/src/ai.ts": `${GW}import { load } from "./data.js";\n`,
    "src/be/dev/src/data.ts": 'import { db } from "@agile/db";\nexport const load = () => db;\n',
  }, { file: "src/be/dev/src/data.ts", line: 1, rule: 1 }],
  ["gateway file reaching @agile/db through a barrel re-export", {
    "src/be/dev/src/ai.ts": `${GW}import { db } from "./barrel.js";\n`,
    "src/be/dev/src/barrel.ts": 'export * from "@agile/db";\n',
  }, { file: "src/be/dev/src/barrel.ts", line: 1, rule: 1 }],
  ["a dynamic import of @agile/db", { "src/be/dev/src/ai.ts": `${GW}const db = await import("@agile/db");\n` }, { file: "src/be/dev/src/ai.ts", line: 2, rule: 1 }],
  ["an inline type modifier beside a value import", { "src/be/dev/src/ai.ts": `${GW}import { type X, db } from "@agile/db";\n` }, { file: "src/be/dev/src/ai.ts", line: 2, rule: 1 }],
  ["a type-only import", { "src/be/dev/src/ai.ts": `${GW}import type { X } from "@agile/db";\n` }, { file: "src/be/dev/src/ai.ts", line: 2, rule: 1 }],
  ["a multi-line import (reported on the module name's line)", { "src/be/dev/src/ai.ts": `${GW}import {\n  db,\n} from "@agile/db";\n` }, { file: "src/be/dev/src/ai.ts", line: 4, rule: 1 }],
  ["a computed dynamic import", { "src/be/dev/src/ai.ts": `${GW}const name = "x";\nawait import(name);\n` }, { file: "src/be/dev/src/ai.ts", line: 3, rule: 4 }],
  ["an unsafe raw method by bracket access", { "src/be/dev/src/data.ts": 'const run = client["$queryRawUnsafe"];\n' }, { file: "src/be/dev/src/data.ts", line: 1, rule: 2 }],
  ["an unsafe raw call in a .mjs file", { "src/be/dev/src/legacy.mjs": "await client.$executeRawUnsafe(sql);\n" }, { file: "src/be/dev/src/legacy.mjs", line: 1, rule: 2 }],
  ["the testing subpath outside the composition root", { "src/be/dev/src/boot.ts": 'import "@agile/ai-context/testing";\n' }, { file: "src/be/dev/src/boot.ts", line: 1, rule: 3 }],
  ["a dynamic import built by concatenation", { "src/be/dev/src/ai.ts": `${GW}await import("@" + "agile/db");\n` }, { file: "src/be/dev/src/ai.ts", line: 2, rule: 4 }],
  ["a computed import after a template literal containing //", { "src/be/dev/src/ai.ts": GW + "const a = `http://x`; await import(name);\n" }, { file: "src/be/dev/src/ai.ts", line: 2, rule: 4 }],
  ["a computed import between template literals containing comment markers", { "src/be/dev/src/ai.ts": GW + "const a = `/*`;\nawait import(name);\nconst b = `*/`;\n" }, { file: "src/be/dev/src/ai.ts", line: 3, rule: 4 }],
  ["a computed import in a helper the gateway file reaches", {
    "src/be/dev/src/ai.ts": `${GW}import { load } from "./data.js";\n`,
    "src/be/dev/src/data.ts": 'const name = "@agile/db";\nexport const load = () => import(name);\n',
  }, { file: "src/be/dev/src/data.ts", line: 2, rule: 4 }],
  ["a relative import that cannot be resolved", { "src/be/dev/src/ai.ts": `${GW}import { q } from "./missing.js";\n` }, { file: "src/be/dev/src/ai.ts", line: 2, rule: 1 }],
  ["a query moved outside src", {
    "src/be/dev/src/ai.ts": `${GW}import { q } from "../lib/data.js";\n`,
    "src/be/dev/lib/data.ts": 'import { db } from "@agile/db";\n',
  }, { file: "src/be/dev/lib/data.ts", line: 1, rule: 1 }],
  ["a query moved into a test directory", {
    "src/be/dev/src/ai.ts": `${GW}import "./test/data.js";\n`,
    "src/be/dev/src/test/data.ts": 'import { db } from "@agile/db";\n',
  }, { file: "src/be/dev/src/test/data.ts", line: 1, rule: 1 }],
  ["a relative path into ai-context's internals", { "src/be/dev/src/x.ts": 'import { resetContextRegistries } from "../../ai-context/src/testing.js";\n' }, { file: "src/be/dev/src/x.ts", line: 1, rule: 3 }],
  ["a deep ai-context subpath", { "src/be/dev/src/x.ts": 'import { coreRegistry } from "@agile/ai-context/src/registry.js";\n' }, { file: "src/be/dev/src/x.ts", line: 1, rule: 3 }],
  ["a gateway subpath import beside @agile/db", { "src/be/dev/src/ai.ts": 'import { FEATURES } from "@agile/llm-gateway/src/config.js";\nimport { db } from "@agile/db";\n' }, { file: "src/be/dev/src/ai.ts", line: 2, rule: 1 }],
];

for (const [name, files, expected] of reported) {
  test(`E30 N2 reported: ${name}`, () => assert.deepEqual(findingsOf(files), [expected]));
}

const clean: Array<[string, Record<string, string>]> = [
  ["a gateway file with allowed imports only", { "src/be/dev/src/ai.ts": `${GW}import { getAiContext } from "@agile/ai-context";\nimport type { Feature } from "@agile/contracts";\n` }],
  ["a data file importing @agile/db only", { "src/be/dev/src/data.ts": 'import { db } from "@agile/db";\n' }],
  ["the testing subpath in the composition root", { "src/be/api/src/wiring.ts": 'import { resetContextRegistries } from "@agile/ai-context/testing";\n' }],
  ["the unsafe raw method names inside src/be/db/src", { "src/be/db/src/client.ts": 'const BLOCKED = ["$queryRawUnsafe", "$executeRawUnsafe"];\n' }],
  ["ai-context's own files importing its internals", { "src/be/ai-context/src/assemble.ts": 'import { coreRegistry } from "./registry.js";\n', "src/be/ai-context/src/registry.ts": "export const coreRegistry = {};\n" }],
  ["a literal dynamic import and a literal template require", { "src/be/dev/src/ai.ts": GW + 'await import("@agile/ai-context");\nrequire(`@agile/contracts`);\n' }],
];

for (const [name, files] of clean) {
  test(`E30 N2 not reported: ${name}`, () => assert.deepEqual(findingsOf(files), []));
}

const ROOT = process.cwd();
async function walk(directory: string, out: Map<string, string>): Promise<void> {
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    const path = join(directory, entry.name);
    // Test directories are read too, so a scanned file that imports from one is followed; they never start a scan.
    if (entry.isDirectory()) { if (!["node_modules", "dist"].includes(entry.name) && !entry.name.startsWith(".")) await walk(path, out); }
    else if (/\.(ts|tsx|mts|cts|js|mjs)$/.test(entry.name)) out.set(relative(ROOT, path).split(sep).join("/"), await readFile(path, "utf8"));
  }
}

test("E31 N2 the repository passes the source scan", async () => {
  const files = new Map<string, string>();
  for (const pkg of await readdir(join(ROOT, "src/be"))) await walk(join(ROOT, "src/be", pkg), files);
  await walk(join(ROOT, "src/fe"), files);
  const result = scan(files);
  assert.ok(result.filesScanned > 0, "the scan read real files");
  assert.ok(files.has("src/be/dev/src/gateway-binding.ts"), "E44 the dev gateway binding is scanned");
  assert.ok(ruleOneFile("src/be/dev/src/gateway-binding.ts"), "E44 rule one applies to the dev gateway binding");
  assert.deepEqual(result.findings, []);
});

test("E19 core context source registration remains fixed and complete", async () => {
  const source = await readFile(join(ROOT, "src/be/core/src/context-sources.ts"), "utf8");
  assert.match(source, /register\("core\.projectBrief", sources\.projectBrief\)/);
  assert.match(source, /register\("core\.checkpoints", sources\.checkpoints\)/);
  assert.match(source, /register\("core\.taskEvents", sources\.taskEvents\)/);
  assert.match(source, /register\("core\.blockedTasks", sources\.blockedTasks\)/);
});
