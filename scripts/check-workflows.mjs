import { readFile } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

const SHA = /^[0-9a-f]{40}$/;

export function validateWorkflowText(text, pins, file = "workflow.yml") {
  const errors = [];
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
  if (/^\s*permissions:\s*\n(?:\s+[^\n]+\n)*?\s+\w+:\s*write\b/m.test(text)) {
    errors.push(`${file}: write permissions are forbidden in pull-request workflows`);
  }
  for (const match of text.matchAll(/^\s*image:\s*([^\s#]+)/gm)) {
    if (!match[1].includes("@sha256:")) errors.push(`${file}: container image ${match[1]} is not pinned by digest`);
  }
  return errors;
}

export async function validateWorkflowDirectory(root = ".") {
  const manifest = JSON.parse(await readFile(join(root, "workflow/action-pins.json"), "utf8"));
  const directory = join(root, ".github/workflows");
  const files = (await readdir(directory)).filter((file) => /\.ya?ml$/.test(file));
  const errors = [];
  for (const file of files) {
    errors.push(...validateWorkflowText(await readFile(join(directory, file), "utf8"), manifest, `.github/workflows/${file}`));
  }
  return errors;
}

async function main() {
  try {
    const errors = await validateWorkflowDirectory();
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
