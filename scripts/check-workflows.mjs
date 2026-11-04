import { readFile } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const SHA = /^[0-9a-f]{40}$/;
export const BOOTSTRAP_BASE_SHA = "7bd65440023a0123ac92445e5b6e58ec838ee57c";
export const BOOTSTRAP_ACTION_PINS = Object.freeze({
  version: 1,
  actions: Object.freeze({
    "actions/checkout": Object.freeze({
      sha: "11bd71901bbe5b1630ceea73d27597364c9af683",
      version: "v4.2.2",
      type: "action",
    }),
    "actions/setup-node": Object.freeze({
      sha: "49933ea5288caeca8642d1e84afbd3f7d6820020",
      version: "v4.4.0",
      type: "action",
    }),
  }),
});

function workflowTriggers(text) {
  const lines = text.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^(\s*)on:\s*(.*)$/i);
    if (!match) continue;
    const inline = match[2].trim();
    if (inline.startsWith("[")) {
      return inline.slice(1, inline.indexOf("]"))
        .split(",")
        .map((value) => value.trim().replace(/^['\"]|['\"]$/g, ""))
        .filter(Boolean);
    }
    if (inline && !inline.startsWith("{")) return [inline.split(/\s+/)[0].replace(/^['\"]|['\"]$/g, "")];
    if (inline.startsWith("{")) {
      return [...inline.matchAll(/['\"]?([\w-]+)['\"]?\s*:/g)].map((item) => item[1]);
    }
    const parentIndent = match[1].length;
    let childIndent = null;
    const triggers = [];
    for (let next = index + 1; next < lines.length; next += 1) {
      const child = lines[next].match(/^(\s*)([\w-]+):/);
      if (!child) {
        if (lines[next].trim() === "") continue;
        const indent = lines[next].match(/^\s*/)[0].length;
        if (indent <= parentIndent) break;
        continue;
      }
      const indent = child[1].length;
      if (indent <= parentIndent) break;
      if (childIndent === null) childIndent = indent;
      if (indent === childIndent) triggers.push(child[2]);
    }
    return triggers;
  }
  return [];
}

function parseActionPins(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || value.version !== 1 || !value.actions || typeof value.actions !== "object"
    || Array.isArray(value.actions)) {
    throw new Error("Action pin manifest must contain version 1 and an actions object");
  }
  return value;
}

export function resolveActionPins({ baseManifest, baseSha, baseBranch, prNumber, bootstrapPrNumber }) {
  if (baseManifest !== null && baseManifest !== undefined) {
    return parseActionPins(typeof baseManifest === "string" ? JSON.parse(baseManifest) : baseManifest);
  }
  if (baseBranch !== "development") throw new Error("bootstrap requires the development target");
  if (baseSha !== BOOTSTRAP_BASE_SHA) throw new Error("base Action manifest is required after bootstrap");
  if (!bootstrapPrNumber || String(prNumber) !== String(bootstrapPrNumber)) {
    throw new Error("bootstrap requires the configured pull request");
  }
  return BOOTSTRAP_ACTION_PINS;
}

function actionManifestAtSha(root, sha) {
  const result = spawnSync("git", ["show", `${sha}:workflow/action-pins.json`], {
    cwd: root,
    encoding: "utf8",
  });
  return result.error || result.status !== 0 ? null : result.stdout;
}

export function validateWorkflowText(text, pins, file = "workflow.yml") {
  const errors = [];
  const triggers = workflowTriggers(text);
  if (triggers.some((trigger) => ["deployment", "deployment_status"].includes(trigger))) {
    errors.push(`${file}: deployment trigger is forbidden in pull-request workflows`);
  }
  if (triggers.length !== 1 || triggers[0] !== "pull_request") {
    errors.push(`${file}: only the pull_request trigger is allowed`);
  }
  for (const match of text.matchAll(/^\s*-?\s*uses:\s*([^\s#]+)/gm)) {
    const reference = match[1];
    const at = reference.lastIndexOf("@");
    const repository = at === -1 ? reference : reference.slice(0, at);
    const sha = at === -1 ? "" : reference.slice(at + 1);
    if (repository.startsWith("./")) continue;
    if (!SHA.test(sha)) errors.push(`${file}: Action ${reference} must use a full commit SHA`);
    const approved = pins?.actions?.[repository];
    if (!approved) errors.push(`${file}: Action repository ${repository} is not in the approved repository manifest`);
    else if (sha !== approved.sha) errors.push(`${file}: Action ${repository} does not match its approved SHA`);
  }
  if (/\b(?:curl|wget)\b[^\n|]*\|\s*(?:sh|bash)\b/i.test(text)) {
    errors.push(`${file}: remote bootstrap commands are forbidden`);
  }
  if (/^\s*pull_request_target\s*:/m.test(text)) {
    errors.push(`${file}: pull_request_target is forbidden in pull-request workflows`);
  }
  if (/^\s*environment\s*:/m.test(text)) {
    errors.push(`${file}: environments are forbidden in pull-request workflows`);
  }
  const lines = text.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const runner = lines[index].match(/^(\s*)runs-on:\s*(.*)$/i);
    if (!runner) continue;
    let selfHosted = /\bself-hosted\b/i.test(runner[2]);
    const runnerIndent = runner[1].length;
    for (let next = index + 1; !selfHosted && next < lines.length && /^[ \t]+/.test(lines[next]); next += 1) {
      const nextIndent = lines[next].match(/^[ \t]*/)[0].length;
      if (nextIndent <= runnerIndent) break;
      selfHosted = /\bself-hosted\b/i.test(lines[next]);
    }
    if (selfHosted) errors.push(`${file}: self-hosted runners are forbidden in pull-request workflows`);
  }
  for (let index = 0; index < lines.length; index += 1) {
    const permission = lines[index].match(/^(\s*)permissions:\s*(.*)$/i);
    if (!permission) continue;
    if (/^write-all\b/i.test(permission[2]) || /\{[^}]*[\w-]+\s*:\s*write\b/i.test(permission[2])) {
      errors.push(`${file}: write permissions are forbidden in pull-request workflows`);
      continue;
    }
    const permissionIndent = permission[1].length;
    for (let next = index + 1; next < lines.length && /^[ \t]+/.test(lines[next]); next += 1) {
      const nextIndent = lines[next].match(/^[ \t]*/)[0].length;
      if (nextIndent <= permissionIndent) break;
      if (/^[ \t]+[\w-]+:[ \t]*write\b/i.test(lines[next])) {
        errors.push(`${file}: write permissions are forbidden in pull-request workflows`);
        index = next;
        break;
      }
    }
  }
  for (const match of text.matchAll(/^\s*image:\s*([^\s#]+)/gm)) {
    if (!match[1].includes("@sha256:")) errors.push(`${file}: container image ${match[1]} is not pinned by digest`);
  }
  return errors;
}

export async function validateWorkflowDirectory(root = ".", options = {}) {
  const baseManifest = options.baseSha
    ? actionManifestAtSha(root, options.baseSha)
    : await readFile(join(root, "workflow/action-pins.json"), "utf8");
  const manifest = resolveActionPins({ ...options, baseManifest });
  const directory = join(root, ".github/workflows");
  const files = (await readdir(directory)).filter((file) => /\.ya?ml$/.test(file));
  const errors = [];
  for (const file of files) {
    errors.push(...validateWorkflowText(await readFile(join(directory, file), "utf8"), manifest, `.github/workflows/${file}`));
  }
  return errors;
}

function parseArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (["--base-sha", "--base-branch", "--pr-number", "--bootstrap-pr-number"].includes(arg)) {
      options[arg.slice(2).replaceAll("-", "_")] = args[++index];
    } else throw new Error(`unknown workflow-check option: ${arg}`);
  }
  return options;
}

async function main() {
  try {
    const errors = await validateWorkflowDirectory(".", parseArgs(process.argv.slice(2)));
    if (errors.length) {
      process.stderr.write(`${errors.join("\n")}\n`);
      process.exitCode = 1;
    }
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
