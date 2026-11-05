# Isolation and transcript findings (T2 spike)

Measured 2026-11-03 against Claude Code **2.1.316** on Windows 11, subscription login (`apiKeySource: "none"`), model `claude-sonnet-5-5`, in a throwaway clone at `../exp-runs/spike-clone`. Raw output stayed under `local/spike/` (gitignored); the scrubbed fixtures are in `fixtures/`. Spike spend: about 0.88 USD of the 3 USD limit. The hooks and built-in findings led to a spec amendment that the owner approved; the derivation below is now in `runtime.md` § Isolation.

## Mandated flag set (verified to run)

Every invocation, first and resumed:

```
claude -p --output-format stream-json --verbose --setting-sources project --strict-mcp-config \
       --model <id> --max-budget-usd <ceiling - spend> [--plugin-dir <abs path>]... \
       [--allowedTools ...] [--disallowedTools WebFetch WebSearch] [--permission-mode <mode>] \
       [--resume <session-id>]
```

`--verbose` is required with `-p` and `stream-json`. The prompt goes in on stdin. `--include-hook-events` exists and is added (see Hooks). `--no-session-persistence` is for the N4 calls only; arm runs need the transcript on disk.

## The init record (`system/init`, first stream line, or second after hook events)

Keys: `cwd, session_id, tools, mcp_servers, model, permissionMode, slash_commands, apiKeySource, claude_code_version, agents, skills, plugins, output_style, ...`

| Set | Field | Form | Notes |
|---|---|---|---|
| skills | `skills` | names; plugin skills are `plugin:skill` | includes **20 built-in skills** that no flag removes: `design, slides, design-sync, dataviz, artifact-diagramming, artifact-capabilities, update-config, verify, debug, code-review, simplify, batch, fewer-permission-prompts, doctor, loop, schedule, claude-api, run, run-skill-generator, plugin-authoring` |
| agents | `agents` | names | **6 built-in**: `claude, claude-code-guide, Explore, general-purpose, Plan, statusline-setup`; project agents from the clone's `.claude/agents` follow |
| plugins | `plugins` | objects `{name, path, source}` | **3 built-in** (`cc-plugin-agents-md`, `cc-plugin-telemetry`, `cc-plugin-plugin-authoring`, source `...@builtin`); `--plugin-dir` plugins appear with `source: <name>@inline` and a `version` |
| MCP | `mcp_servers` | array, empty with `--strict-mcp-config` and no `--mcp-config` | |
| tools | `tools` | names; 30 in this probe, including `Task` (the subagent tool; its calls are named `Agent`), `Skill`, `WebFetch`, `WebSearch` | the list depends on account features (`Artifact`, `Cron*`, ...); record a baseline per CLI version |
| **hooks** | **none** | **the init record has no hooks field** | see Hooks and D~1 |

`--setting-sources project` kept all user-level skills, plugins and settings out of the lists: the only non-project entries are the built-ins above. The clone's own `.claude/skills` (17) and `.claude/agents` (10) were listed in full.

## Expected-set derivation (now runtime.md § Isolation step 2)

**Built-ins are optional (C~12, found by the first pilot batch).** Feature-gated built-ins (`slides`, the artifact skills, `claude-code-guide`, the `Artifact*` tools) were present in the spike session and absent in the batch session. A set therefore has `required` entries (arm and plugin entries) and `optional` ones (the built-in constants): required entries must appear, anything outside required plus optional is a mismatch.

Compare as sorted sets, ignoring `config.json` `isolation_ignore`:

- **skills** = built-in skills + arm `skills` + `<plugin>:<skill>` for each skill folder of each arm plugin. The built-in list is a committed constant per CLI version, taken from a plain probe of an empty clone (`fixtures/init-record.json` is the reference).
- **agents** = built-in agents + arm `agents` + agents declared by arm plugins.
- **plugins** = built-in plugins + one `{name}` per arm plugin (match on `name`, not `path`).
- **mcp** = arm `mcp` (names), default `[]`.
- **tools** = baseline tool list for the CLI version + arm `allowed_tools` additions that are not already present - `disallowed_tools` removals. Whether `--disallowedTools` removes a name from this list was not measured; T3's probe test must assert it before relying on it.
- **hooks**: see below.

A different CLI version invalidates the built-in constants; `exp check` compares `claude_code_version` with the fixture's and warns.

## Hooks (D~1)

The init record carries no hooks. What the stream does carry:

- `system/hook_started` and `system/hook_response` events (fields `hook_name` e.g. `SessionStart:startup`, `hook_event`, `outcome`), emitted **before** the init record. The probe with the superpowers plugin showed exactly one pair (its SessionStart hook, `outcome: success`, which injects text into the session). The plain probe showed none.
- Only hooks that fired are visible. A `PreToolUse` or other event hook of a plugin appears only if the probe triggers it.

Replacement for the hooks set (approved; now runtime.md § Isolation step 4): launch with `--include-hook-events`; the observed set is the `hook_name` values of the probe; the expected set is the SessionStart hooks declared in each arm plugin's `hooks/hooks.json` (none for the clone, whose settings are stripped); any observed hook not expected aborts as `isolation_mismatch`. Non-SessionStart hooks of an arm plugin cannot be confirmed by the probe; they are covered by the plugin directory hash in the approval (E4) and by comparing only the plugin files.

## Cost and usage

- Reference total: `result.total_cost_usd` (also `result.modelUsage.<model>.costUSD`, with `costBasis: "list"`). It **sums across resumed invocations**: a resumed session reported 0.0811 = first invocation 0.0491 + its own 0.0320, and `modelUsage` token counts were the sums. It **includes subagents**: for the full-flow toy run, distinct-message-id sums over the main and three subagent transcripts equal `modelUsage` exactly (in 28, out 6073, cache read 307780, cache write 38503 = 22881 5-minute + 15622 1-hour). N1 therefore compares against the **last** result of the session, never a sum of results; a harness that sums results double counts.
- `usage.cache_creation` splits writes into `ephemeral_5m_input_tokens` and `ephemeral_1h_input_tokens`; most writes were 1-hour in the plain probes, 5-minute appeared with subagents. `events.csv` stores one `cache_write_tok` (their sum), but the cost needs the split, so T5 keeps the two buckets in `usage.json`.
- Budget cap `--max-budget-usd` is **per invocation**: a resume with a 0.05 cap ran fine at a session total of 0.0855 (this invocation cost 0.0044). So "ceiling minus spend so far" in F14 is right.
- Budget stop shape: process exit 1; result `subtype: "error_max_budget_usd"`, `terminal_reason: "budget_exhausted"`, `is_error: true`, `errors: ["Reached maximum budget ($0.01)"]`. It overshot a 0.01 cap by 0.03 (the first call cannot be cut). Fixture: `fixtures/cli-result-budget-stop.json`. A normal result has `subtype: "success"`, `terminal_reason: "completed"`.
- Prices: `pricing.json` was filled from the CLI's own `costUSD` by an exact fit (zero residual over seven results): input 2, output 10, cache read 0.1, cache write 5m 2.5, cache write 1h 4 USD per million. The ponytail table (`hooks/ponytail-band-import.js`, entry `claude-sonnet-5-5`) gives the same five numbers, so there is no difference to note. The Anthropic pricing page (platform.claude.com/docs/en/about-claude/pricing, Claude Sonnet 5.5 row) was fetched afterwards and lists the same five numbers (input 2, 5m write 2.5, 1h write 4, cache hit 0.10, output 10).

## Transcripts

- Main: `~/.claude/projects/<cwd with `:` `\` `/` replaced by `-`>/<session-id>.jsonl`, e.g. `S--CS3227-exp-runs-spike-clone/<id>.jsonl`. One file per session id; a resume appends to the same file and keeps the same session id.
- Subagents: `<session-id>/subagents/agent-<agentId>.jsonl` plus `.meta.json` (`agentType`, `toolUseId`, `spawnDepth`, `description`) and `.prefix.json` (cache-prefix bookkeeping, ignore). Link to the parent: `meta.toolUseId` equals the `id` of the parent's `Agent` tool call; subagent lines carry `isSidechain: true`, `agentId`, and the parent's `sessionId`; `parentUuid` is null for the first line. Nested subagents were not exercised (`spawnDepth` suggests the depth is recorded there).
- Line types in the main file: `user, assistant, attachment, queue-operation, last-prompt, file-history-snapshot, atis-latch, api-request-shape, api-request-blob, api-request, tools-used, cost-state`. Only `assistant` (usage) and `user` (tool results) matter to T5; `api-request-blob` is large and contains prompt text.
- **Duplicate message ids occur**: one API message is split over several lines (thinking, then tool use), all repeating the same `message.id` and the same `usage`. Fixture `transcript-main.jsonl` has 8 assistant lines and 7 distinct ids. Rule for T5: one row per distinct `message.id`, last usage kept (they were identical).
- Event time: each line has `timestamp`; the stream has the same events live, so a crashed run still has its transcript.
- Tool calls: the subagent launcher is `Agent` (input `description, subagent_type, prompt`); skills are `Skill` (input `{skill}`, plugin skills as `superpowers:brainstorming`); `Bash` input is `{command}`. A Bash tool result is `{type: "tool_result", tool_use_id, content, is_error}` and the user line has `toolUseResult` with `stdout, stderr, interrupted`. **A failing Bash call was not produced in the spike**, so how a non-zero exit shows (`is_error: true` is the expected form) is unverified; T5's `fix_iterations` test uses a synthetic fixture and T9 checks it on real runs.
- Subagents may run in the background (`requestShape: "background"`, `async_launched`); the main result still includes their usage.

## OpenTelemetry

With `CLAUDE_CODE_ENABLE_TELEMETRY=1`, `OTEL_METRICS_EXPORTER=console`, `OTEL_LOGS_EXPORTER=console` in headless `-p` mode, nothing was printed to stdout or stderr beyond the normal stream. No telemetry file was produced. Result: the framework does not depend on OpenTelemetry; transcripts are the source, as the spec assumes (`otel.log` stays optional and unused in v1).

## Windows launcher

- `claude` resolves to the native `C:\Users\<user>\.local\bin\claude.exe`; `spawn` with an argument array and no shell works.
- The npm shim `%APPDATA%\npm\claude.cmd` fails without a shell: `spawn` returns `EINVAL` (Node 22 refuses `.cmd`). This agrees with the rule that a `.cmd`, `.bat` or `.ps1` launcher is refused with exit 3 (N7, E61).
- `claude --version` prints `2.1.316 (Claude Code)`.

## Toy costs per arm (cost of the toy request `add a --shout flag to a tiny hello-world CLI`, spec and plan, one run each)

| Arm flow | `total_cost_usd` | Notes |
|---|---|---|
| superpowers (brainstorming, then writing-plans) | 0.1312 | 2 Skill calls, 2 files written |
| lite (writing-specs-lite, writing-plans-lite) | 0.1358 | 2 Skill calls, no subagent |
| full (spec-writer, reviewer, planner agents) | 0.2113 | 3 background subagents |

Ceiling rule (this plan's own choice): run ceiling = 3 x the highest toy cost = **0.6338 USD**; batch ceiling = 5 x the run ceiling = **3.169 USD**. The toy request is much smaller than the pilot brief, so these may be tight; the owner confirms or changes them at the T9 gate, and extra replicates need a new confirmation.

## Fixtures (scrubbed: home, clone and repo paths, user name and e-mail replaced; ids kept)

| File | Source | Used by |
|---|---|---|
| `init-record.json` | plain probe init record | isolation tests (T3), built-in set constants |
| `transcript-main.jsonl` | full-flow toy run, main session, reduced to assistant, user and cost-state lines, thinking text emptied | extractor tests (T5), duplicate ids |
| `transcript-subagent.jsonl`, `.meta.json` | the reviewer subagent of the same run | extractor linking (T5) |
| `cli-result.json` | probe with one subagent | N1 reference total, cumulative `modelUsage` |
| `cli-result-budget-stop.json` | probe with a 0.01 cap | budget mapping (E65) |

## Implementation stage findings (T1 spike, 2026-11-05, Windows 11, Node 22.23, npm 10.9)

Measured by `harness/spike/impl-spike.mjs` on the pilot base commit `160053c` in a history-free tree.

**History-free tree.** `git archive` + `tar` + `git init` + one commit `base` takes about 31 s; `git log --all` shows one commit and `for-each-ref` one ref (`refs/heads/master`). GNU tar from Git for Windows reads `S:...` as `host:path` ("Cannot connect to S: resolve failed"): extract with relative names and `cwd` set to the work folder, or avoid `tar`.

**Check environment (N3).** Final variable list, all that was needed: `PATH`, `PATHEXT`, `ComSpec`, `SystemRoot`, `TEMP`, `TMP`, `HOME`, `USERPROFILE`, `APPDATA`, plus `npm_config_cache` when the parent has it set (it is not set on this machine). No variable had to be added after the first run. `npm ci --ignore-scripts`, `tsc`, and `node --import tsx --test` all ran with only these.

**Setup needs a second step.** `npm ci --ignore-scripts` skips `prisma generate`, so `node node_modules/typescript/bin/tsc -b` fails at the base commit (5 errors in `src/be/db/src/client.ts`, exit 2). `node node_modules/prisma/build/index.js generate --schema src/be/db/prisma/schema.prisma` works under the stripped environment (21 s, no scripts) and `tsc -b` then exits 0. The task file gets `post_setup` for it (data-model.md).

**Timings (seconds).** `npm ci --ignore-scripts` 110 (network); `prisma generate` 21; `tsc -b` 6.7 (after generate); `tsc --noEmit` in `src/fe` 10; one test file (`date-rules.test.ts`, 5 tests) 1.1; recursive copy of `node_modules` 55 (15,289 files). A verify tree therefore costs about a minute for the copy.

**tsx.** Resolves from the tree (`node_modules/tsx` present), so `node --import tsx --test` works with the tree as working directory.

**TAP format** (`--test-reporter=tap`): `TAP version 13`, then per test `# Subtest: <name>`, `ok <n> - <name>` or `not ok <n> - <name>`, an indented YAML block (`duration_ms`, `type: 'test'`), and a summary of `# tests`, `# suites`, `# pass`, `# fail` lines. Nested tests are indented by two spaces per level. A file that prints nothing has no `ok` line.

**Links on this machine.** `fs.lstat` on a directory junction reports `isSymbolicLink() === true` and `isDirectory() === false`; a file symlink reports `isSymbolicLink() === true`; a hardlink reports `nlink === 2` on both names. Creating them needed no elevation here. Walkers can use `lstat` alone.

**Process containment.** A detached grandchild started through an intermediate process that then exits **survives** `killTree(parent.pid)` (`taskkill /PID <pid> /T /F`). Finding it by a PowerShell filter and killing it works: `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*<marker>*' -and $_.Name -eq 'node.exe' }`, then `taskkill /PID <pid> /T /F`; the marker is a string in the grandchild's command line (a path under the clone also works). The end-of-turn sweep is therefore required, as the spec assumes.

**Toy implementation build.** Sonnet 5.5 at `--effort low` with the harness flags (`--setting-sources project`, `--strict-mcp-config`, Read/Write/Edit/Bash/Glob/Grep allowed, WebFetch/WebSearch denied, `--max-budget-usd 3`) wrote a function and a test and ran it in 18 s: `total_cost_usd` **0.0561** (2 turns). The cost computed from `pricing.json` with the result event's `usage` totals (input 4, output 256, cache read 65,825, cache write 1h 11,732) is 0.0560785, equal to the CLI total. The per-message `usage` of the `assistant` stream events undercounts output tokens (30 against 256), so cost must be taken from the result event or the final totals, never summed from assistant events. Because the prompt cache writes use the 1-hour tier here, cache writes dominate the cost of a small build.
