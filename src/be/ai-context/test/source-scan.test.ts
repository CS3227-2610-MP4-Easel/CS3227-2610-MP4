import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join, posix, relative, sep } from "node:path";
import { test } from "node:test";
import ts from "typescript";

// The AD-25 / A-08 source scan (spec conventions.md § Source-scan rule). A pure function over path -> content, so the
// fixtures below are inline strings and the repository scan never reads them.
type Finding = { file: string; line: number; rule: 1 | 2 | 3 | 4 };
type Import = { spec: string; line: number };

const BE_SRC = /^src\/be\/[^/]+\/src\//;
const ruleOneFile = (path: string) => BE_SRC.test(path) && !/^src\/be\/(db|llm-gateway|proposals|ai-context)\//.test(path);
const ruleTwoFile = (path: string) => (BE_SRC.test(path) || path.startsWith("src/fe/")) && !path.startsWith("src/be/db/src/");
const ruleThreeFile = (path: string) => (BE_SRC.test(path) || path.startsWith("src/fe/")) && !path.startsWith("src/be/api/src/");
const ALLOWED_IN_GATEWAY_FILES = new Set(["@agile/contracts", "@agile/ai-context", "@agile/llm-gateway"]);
const lineAt = (text: string, index: number) => text.slice(0, index).split("\n").length;

/** Every import, re-export, `import()` and `require()` with a literal specifier, type-only ones included. */
function importsOf(content: string): Import[] {
  return ts.preProcessFile(content, true, true).importedFiles.map((f) => ({ spec: f.fileName, line: lineAt(content, f.pos) }));
}

/** Comments and the contents of quoted strings blanked to spaces (newlines kept), so rule 4 sees code only. */
function codeOnly(content: string): string {
  return content.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g, (m) =>
    m.startsWith("/") ? m.replace(/[^\n]/g, " ") : m[0] + " ".repeat(m.length - 2) + m[0]);
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
    if (ruleThreeFile(path)) for (const i of imports) if (i.spec === "@agile/ai-context/testing") add({ file: path, line: i.line, rule: 3 });
    if (!ruleOneFile(path) || !imports.some((i) => i.spec === "@agile/llm-gateway")) continue;

    const code = codeOnly(content);
    for (const m of code.matchAll(/\b(?:import|require)\s*\(\s*[^'"\s)]/g)) add({ file: path, line: lineAt(code, m.index), rule: 4 });
    // Rule 1: this file and everything it reaches through relative imports may use only the allowed workspace packages.
    const seen = new Set<string>();
    const queue = [path];
    while (queue.length > 0) {
      const current = queue.pop() as string;
      if (seen.has(current)) continue;
      seen.add(current);
      for (const i of importsOf(files.get(current) ?? "")) {
        if (i.spec.startsWith(".")) { const next = resolve(files, current, i.spec); if (next) queue.push(next); continue; }
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
];

for (const [name, files, expected] of reported) {
  test(`E30 N2 reported: ${name}`, () => assert.deepEqual(findingsOf(files), [expected]));
}

const clean: Array<[string, Record<string, string>]> = [
  ["a gateway file with allowed imports only", { "src/be/dev/src/ai.ts": `${GW}import { getAiContext } from "@agile/ai-context";\nimport type { Feature } from "@agile/contracts";\n` }],
  ["a data file importing @agile/db only", { "src/be/dev/src/data.ts": 'import { db } from "@agile/db";\n' }],
  ["the testing subpath in the composition root", { "src/be/api/src/wiring.ts": 'import { resetContextRegistries } from "@agile/ai-context/testing";\n' }],
  ["the unsafe raw method names inside src/be/db/src", { "src/be/db/src/client.ts": 'const BLOCKED = ["$queryRawUnsafe", "$executeRawUnsafe"];\n' }],
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
    if (entry.isDirectory()) { if (!["node_modules", "dist", "test"].includes(entry.name)) await walk(path, out); }
    else if (/\.(ts|tsx|mts|cts|js|mjs)$/.test(entry.name)) out.set(relative(ROOT, path).split(sep).join("/"), await readFile(path, "utf8"));
  }
}

test("E31 N2 the repository passes the source scan", async () => {
  const files = new Map<string, string>();
  for (const pkg of await readdir(join(ROOT, "src/be"))) await walk(join(ROOT, "src/be", pkg, "src"), files);
  await walk(join(ROOT, "src/fe"), files);
  const result = scan(files);
  assert.ok(result.filesScanned > 0, "the scan read real files");
  assert.deepEqual(result.findings, []);
});
