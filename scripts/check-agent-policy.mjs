import { validatePolicy } from "../workflow/tools/agent-policy.mjs";
import { mediateAgentOperation } from "../workflow/tools/agent-mediation.mjs";

const source = process.argv[2] ?? "workflow/agent-permissions.json";
const result = await validatePolicy(source);
if (!result.valid) {
  console.error(`agent policy invalid: ${result.errors.join("; ")}`);
  process.exitCode = 1;
} else {
  const probes = [
    [{ operation: "read", scope: "repository", target: "src" }, true, "allowed"],
    [{ operation: "read", scope: "secrets", target: "DATABASE_URL" }, false, "default-deny"],
    [{ operation: "secret", target: "DATABASE_URL" }, false, "denied"],
    [{ operation: "write", target: ".github/workflows/ci.yml" }, false, "review-required"],
  ];
  for (const [request, allowed, reason] of probes) {
    const decision = await mediateAgentOperation(request, source);
    if (decision.allowed !== allowed || decision.reason !== reason) {
      console.error(`agent policy mediation failed for ${JSON.stringify(request)}: ${JSON.stringify(decision)}`);
      process.exitCode = 1;
      break;
    }
  }
}
