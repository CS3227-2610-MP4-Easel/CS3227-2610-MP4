import { spawnSync } from "node:child_process";

const SECRET_PATTERNS = [
  /(password\s*[:=]\s*)\S+/gi,
  /(secret\s*[:=]\s*)\S+/gi,
  /(token\s*[:=]\s*)\S+/gi,
  /(gh[pousr]_[A-Za-z0-9_]{16,})/g,
  /(sk-[A-Za-z0-9_-]{16,})/g,
];

export function redactOutput(value) {
  return SECRET_PATTERNS.reduce(
    (output, pattern) => output.replace(pattern, (...matches) => {
      const prefix = matches.length > 2 && typeof matches[1] === "string" && /[:=]/.test(matches[1])
        ? matches[1]
        : "";
      return `${prefix}[REDACTED]`;
    }),
    value,
  );
}

export function parseScanArgs(args) {
  let staged = false;
  let baseSha;
  let headSha;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--staged") staged = true;
    else if (arg === "--base-sha") baseSha = args[++index];
    else if (arg === "--head-sha") headSha = args[++index];
    else throw new Error(`unknown scan option: ${arg}`);
  }
  if (staged && (baseSha || headSha)) throw new Error("--staged cannot be combined with a PR range");
  if ((baseSha && !headSha) || (!baseSha && headSha)) throw new Error("both --base-sha and --head-sha are required");
  if (baseSha && headSha) return { mode: "range", baseSha, headSha };
  return { mode: staged ? "staged" : "tree" };
}

export function buildGitleaksArgs(options) {
  const args = ["detect", "--config", ".gitleaks.toml", "--no-banner", "--redact", "--exit-code", "1"];
  if (options.mode === "staged") args.push("--pipe");
  else args.push("--source", ".");
  if (options.mode === "range") args.push(`--log-opts=${options.baseSha}..${options.headSha}`);
  return args;
}

export function runScan(args = process.argv.slice(2), env = process.env) {
  const options = parseScanArgs(args);
  const binary = env.GITLEAKS_BIN || "gitleaks";
  const input = options.mode === "staged"
    ? spawnSync("git", ["diff", "--cached", "--binary"], { encoding: "utf8" }).stdout
    : undefined;
  const result = spawnSync(binary, buildGitleaksArgs(options), { encoding: "utf8", input });
  if (result.error) {
    process.stderr.write("secret scan unavailable: Gitleaks 8.24.2 is required\n");
    return 2;
  }
  const output = redactOutput(`${result.stdout || ""}${result.stderr || ""}`);
  if (output) process.stderr.write(output);
  return result.status ?? 2;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    process.exitCode = runScan();
  } catch (error) {
    process.stderr.write(`${redactOutput(error instanceof Error ? error.message : String(error))}\n`);
    process.exitCode = 2;
  }
}
