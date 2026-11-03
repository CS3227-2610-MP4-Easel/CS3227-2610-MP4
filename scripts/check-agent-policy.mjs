import { validatePolicy } from "../workflow/tools/agent-policy.mjs";

const result = await validatePolicy(process.argv[2] ?? "workflow/agent-permissions.json");
if (!result.valid) {
  console.error(`agent policy invalid: ${result.errors.join("; ")}`);
  process.exitCode = 1;
}
