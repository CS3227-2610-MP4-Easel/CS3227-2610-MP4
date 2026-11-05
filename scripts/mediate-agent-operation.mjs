import { readFile } from "node:fs/promises";
import { mediateAgentOperation } from "../workflow/tools/agent-mediation.mjs";

export async function runMediation(args = process.argv.slice(2)) {
  const requestFile = args.indexOf("--request");
  const policyFile = args.indexOf("--policy");
  if (requestFile < 0 || !args[requestFile + 1]) throw new Error("--request <json-file> is required");
  const request = JSON.parse(await readFile(args[requestFile + 1], "utf8"));
  const policy = policyFile >= 0 ? args[policyFile + 1] : undefined;
  const result = await mediateAgentOperation(request, policy);
  process.stdout.write(`${JSON.stringify(result)}\n`);
  return result.allowed ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMediation().then((status) => { process.exitCode = status; }).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
  });
}
