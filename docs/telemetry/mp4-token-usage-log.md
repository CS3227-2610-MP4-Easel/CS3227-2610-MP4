# MP4 token and resource-use log

Evidence base for a talk on spec-driven development, context engineering and resource-aware use. Everything here is read from session logs and repo records; numbers are exact unless marked *est.* Dates are UTC (the machine's local time is UTC+8; e.g. 07:23Z = 15:23 local). Compiled 2026-11-11.

> **How to use this file.** §1 is the one-screen summary. §10 is the "good / bad / unknown" list with the evidence behind each claim. §7 and §8 answer "is there a v1-vs-v2 comparison?" (short answer: no controlled one exists; there are four partial proxies, and one of them is the experiment that *caused* v2). Everything else is the raw material.

---

## 0. Scope, sources and method

### What was read

| Source | What it holds | Volume |
|---|---|---|
| Claude Code session logs, `~/.claude/projects/S--CS3227-CS3227-2610-MP4` | Your interactive sessions in the main folder, plus their `subagents/` logs | 100 files (41 main, 59 subagent) |
| Same, folders `…MP4-w7`, `…MP4-w7-impl`, `…MP4-w7-link-ui` | Sessions run from the three git worktrees of this repo | 24 files |
| Same, folders `S--CS3227-exp-runs-*` (+ spike dirs) | The clones the experiment harness ran `claude` in (plan-stage and implementation-stage runs) | 149 files |
| Codex rollouts, `~/.codex/sessions` mentioning `CS3227-2610-MP4` | Your Codex Desktop work on this repo: PR reviews and the W7b / W7c builds | 120 threads |
| Repo records | `docs/telemetry/experiments/*.csv` and `pilot-overall-report.md`, `workflow/project-state/branch-states/*`, `docs/skill-ecosystem-*.md`, specs, plans, skills | n/a |

The folder you named is 100 of the 273 Claude log files. I also included the three worktree folders and the experiment-run clones because they are the same project and contain the experiment you asked about; each table says which it covers.

### Method (so the numbers can be defended)

1. **One API response is logged several times** (one entry per streamed content block, all carrying the same `usage`). I dedupe by `message.id`. Example: one main log has 381 assistant entries but 147 real responses.
2. **Forks and resumes copy history.** 520 message ids appear in two or more files (e.g. the 8 sibling files of the "Specs/plan lite skills restructuring" session, 5 forks of the experiment build). I attribute each response once, to the earliest file that holds it, and group connected files into a *session family* (§3). Summing raw logs would give **$403.71; the deduplicated figure is $278.98** (the raw sum overstates by 45%). The copied entries are history, not new billing; what a fork really costs is a cold cache re-write on its first call (§4.3).
3. **Price.** Every Claude call is `claude-sonnet-5-5` (39 early calls are `claude-sonnet-5`, 2 are `claude-haiku-5-5`; all priced at the Sonnet 5.5 rate). Rates are the repo's own `workflow/experiments/pricing.json`, USD per million tokens: input 2.00, output 10.00, cache read 0.10, cache write 5-minute 2.50, cache write 1-hour 4.00. Session logs also carry an `advisorModel: claude-opus-5-5` field on each call, but the CLI's own cost tally lists no Opus usage, so I treat it as configuration, not billed tokens.
4. **Cross-check.** Every log ends with a `cost-state` record (the CLI's own running total, which includes subagents). For 15 sessions with no forked ancestry, my recomputed cost equals the CLI total to the cent. For forked chains the CLI total is cumulative across the chain, so I use it only as a check. Gaps of up to about 6% appear on long sessions (e.g. the W10 UI session: $18.59 from logs vs $19.61 CLI); the CLI total contains small uncached-input charges that no log line carries (*hypothesis: the auto-mode permission classifier calls; the logs show a `serverClassifierRequest` id on tool calls*). Treat my dollar figures as a slight lower bound.
5. **Subscription vs list price.** The dollar figures are list-price equivalents. What you actually felt was the subscription's 5-hour limit (hit twice during the experiment, §8; Codex hit 100% of its 5-hour window during the W7c build, §9).
6. **Codex** logs report cumulative `input_tokens` (which *includes* cached), `cached_input_tokens`, `output_tokens` and `reasoning_output_tokens` per thread, with no cache-write split and no price for `gpt-6.1-terra`. I report tokens only and never convert to dollars.
7. **Token ≠ cost.** Throughout, check which column you quote: cache reads are 96.8% of tokens but 34% of dollars.

### What is *not* in the data

* Teammates' sessions (the W2–W6 and W13 specs and plans were mostly written by `teleifo` / `ludannnn`) are not on this machine, so no token record exists for how the v1 or v2 skills performed for them. Only their artifacts exist.
* The W7b implementation (9 Nov) and the W7c implementation (10 Nov) ran in **Codex**, not Claude Code. That is why the Claude logs go quiet on 9 Nov.
* Per-skill token attribution does not exist in the logs. I can give skill file sizes (§7.4) and first-call context sizes, not "tokens spent inside skill X".
* No quality score exists for your interactive sessions, only for the experiment runs.

---

## 1. Headline numbers

| Measure | Value |
|---|---|
| Claude Code log files read | 273 (124 in the MP4 folder and its worktrees, 149 experiment clones) |
| API responses, raw entries → unique | 7,639 → **5,712** |
| Total Claude spend, list-price equivalent | **$278.98** |
| ↳ interactive sessions | $199.71 (main sessions $181.63, subagents $18.08) |
| ↳ experiment runs (harness-driven) | $79.26 (main $48.65, subagents $30.61) |
| Fresh (uncached) input tokens, all Claude calls | **11,934** (of 976.9M input-side tokens) |
| Cache read / cache write / output tokens | 945.9M / 31.0M (7.9M 5-minute + 23.1M 1-hour) / 7.2M (thinking 2.1M = 29%) |
| Cache-read share of input-side tokens | **96.8%** (main sessions 97.4%, subagents 90.3%) |
| Where the dollars go | cache write **40%** ($112.13), cache read 34% ($94.59), output 26% ($72.23), fresh input 0% |
| Interactive subagents | 71 agents, $18.08 = **9%** of interactive spend |
| Median context per call: main vs subagent | **217K vs 37K** tokens (p90 459K vs 99K, max 650K vs 183K) |
| Calls with ≥300K context | 31% of main calls but **46% of main-session spend** |
| Cold-cache rebuilds after >1 h idle | 36 events, 8.35M tokens re-written, **$33.41 (18% of interactive main spend)** |
| Spend by what the work was | process/tooling 65% (experiment framework 29% + experiment runs 28% + skill engineering 8%), product code 28% (W7 20%, W10 UI 8%), architecture 4%, reviews/misc 2% |
| Codex (not priced) | 120 threads · 333.8M input tokens (98.1% cached) · 457K output tokens |

Busiest days (UTC): 3 Nov $49.36, 4 Nov $41.94, 6 Nov $39.43, 7 Nov $34.55, 5 Nov $33.21 (full table: Appendix A).

---

## 2. Token anatomy

### 2.1 By bucket and token type

| Bucket | API calls | Fresh input | Cache read | Cache write 5m | Cache write 1h | Output | (of which thinking) | Cache-read share of input | $ cache read | $ cache write | $ output | Total $ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Interactive - main | 2825 | 6,186 | 702.56M | 0K | 18.59M | 3.70M | 1.11M | 97.4% | $70.26 | $74.35 | $37.01 | $181.63 |
| Interactive - subagents | 675 | 1,364 | 29.46M | 3.17M | 0K | 720K | 248K | 90.3% | $2.95 | $7.93 | $7.20 | $18.08 |
| Experiment runs - main | 1529 | 3,034 | 158.22M | 0K | 4.52M | 1.48M | 247K | 97.2% | $15.82 | $18.06 | $14.76 | $48.65 |
| Experiment runs - subagents | 674 | 1,350 | 55.69M | 4.72M | 0K | 1.32M | 510K | 92.2% | $5.57 | $11.79 | $13.25 | $30.61 |
| **All Claude Code** | 5712 | 11,934 | 945.94M | 7.89M | 23.10M | 7.22M | 2.12M | 96.8% | $94.59 | $112.13 | $72.23 | $278.98 |

How to read: the same call is cheap or expensive depending on what the tokens are. A main session re-reads a 200–650K-token conversation on almost every step; that read is billed at $0.10/M, but every time the cache is cold the same tokens are re-written at $4.00/M (40× the read price).

### 2.2 What the numbers say

* **Input is almost entirely cache.** Fresh input is 11,934 tokens in total, i.e. context is paid for as cache read/write, never as plain input. Conversations are priced by *how often the context is touched* and *how often the cache goes cold*, not by how much you type.
* **Output is tiny but not free.** 0.7% of tokens, 26% of dollars. Thinking tokens are 29% of output (2.12M of 7.22M).
* **Main sessions use the 1-hour cache, subagents the 5-minute cache.** Main sessions therefore survive coffee breaks but not overnight; subagents are short-lived so they never needed the longer TTL.
* **Subagents start cold.** 49 of 71 interactive subagents made their first call with zero cache read. Their first-call context is a median 7.5K tokens (min 4.1K), which is the real per-agent overhead; main sessions' first call is a median 95K (min 49K), most of that being forked history plus system prompt, `CLAUDE.md`/`AGENTS.md`, skill list and tool schemas.

---

## 3. Session catalogue (families, deduplicated)

One row per *session family* (a session plus every fork, resume and subagent that shares its history). IDs S01–S25 are mine. Context type is my classification from the first prompt, branch and activity. "Hit rate" = cache read ÷ all input-side tokens. Peak ctx = largest single-call context in the family.

| ID | Context type | What the session(s) did | Start (UTC) | Span (h) | Log files | Subagents | API calls | Cache read | Cache write | Output | Hit rate | Peak ctx | Main $ | Sub $ | Total $ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| S01 | Architecture & requirements | Brief ingestion (aborted first try) | 10-28T07:23 | 0.0 | 1 | 0 | 3 | 229K | 52K | 1,516 | 81.6% | 97K | $0.24 | $0.00 | $0.24 |
| S02 | Architecture & requirements | AI-infused web app: architecture design (decision-round Q&A) | 10-28T08:46 | 19.7 | 2 | 0 | 174 | 36.87M | 759K | 371,263 | 98.0% | 474K | $10.44 | $0.00 | $10.44 |
| S03 | Architecture & requirements | Attacker-lens threat review of architecture D25-28 | 10-28T13:56 | 1.2 | 1 | 0 | 17 | 2.38M | 129K | 43,473 | 94.8% | 183K | $1.19 | $0.00 | $1.19 |
| S04 | Workflow/skill engineering | Skill ecosystem design: context-management improvements | 10-29T01:43 | 41.1 | 3 | 0 | 80 | 16.33M | 433K | 103,626 | 97.4% | 278K | $4.40 | $0.00 | $4.40 |
| S05 | Workflow/skill engineering | Skill ecosystem design review (2 calls) | 10-29T03:41 | 0.0 | 1 | 0 | 2 | 156K | 53K | 5,389 | 74.8% | 107K | $0.28 | $0.00 | $0.28 |
| S06 | Workflow/skill engineering | Apply approved skill-ecosystem revisions (starter) | 10-30T17:39 | 0.0 | 1 | 0 | 4 | 421K | 71K | 1,269 | 85.5% | 125K | $0.34 | $0.00 | $0.34 |
| S07 | Workflow/skill engineering | Build v1 skills (project-state, branch-state...) + 3 fixture-test subagents | 10-30T17:43 | 6.8 | 4 | 3 | 186 | 40.31M | 1.06M | 202,702 | 97.4% | 372K | $9.04 | $0.88 | $9.92 |
| S08 | UI design (W10) | W10 page-flow & interactions document | 11-01T03:12 | 16.2 | 2 | 1 | 79 | 11.79M | 510K | 128,896 | 95.9% | 207K | $4.01 | $0.39 | $4.40 |
| S09 | UI design (W10) | W10 UI prototypes (Artifacts, shadcn/ui-ux-pro-max) | 11-01T05:03 | 32.0 | 2 | 0 | 371 | 87.10M | 1.30M | 466,277 | 98.5% | 562K | $18.59 | $0.00 | $18.59 |
| S10 | Misc | Local-command session (fold-w10-state) | 11-02T13:10 | 0.0 | 1 | 0 | 6 | 278K | 28K | 2,419 | 90.8% | 53K | $0.16 | $0.00 | $0.16 |
| S11 | Misc | PM slice readiness question | 11-02T13:27 | 0.0 | 1 | 0 | 3 | 197K | 38K | 1,142 | 83.7% | 84K | $0.18 | $0.00 | $0.18 |
| S12 | Experiment framework (v1 era) | Experiment framework: worktree strategy, v1 spec, 2 review rounds, plan | 11-02T17:58 | 12.2 | 10 | 7 | 140 | 24.90M | 920K | 263,576 | 96.4% | 415K | $7.32 | $1.16 | $8.48 |
| S13 | Review of teammates' PRs | W1 PR review (initial) | 11-03T00:42 | 0.0 | 1 | 0 | 11 | 1.01M | 64K | 10,187 | 94.0% | 118K | $0.46 | $0.00 | $0.46 |
| S14 | Review of teammates' PRs | W1 PR review (robustness check) | 11-03T01:45 | 0.8 | 1 | 0 | 50 | 7.63M | 150K | 59,486 | 98.1% | 204K | $1.96 | $0.00 | $1.96 |
| S15 | Misc | /ponytail band (token-band import) | 11-03T06:22 | 0.0 | 1 | 0 | 2 | 127K | 20K | 787 | 86.3% | 74K | $0.10 | $0.00 | $0.10 |
| S16 | Experiment framework (v1 era) | Experiment framework build (v1 executing-plans), pilot orchestration, impl-stage v1 spec+plan | 11-03T06:25 | 41.8 | 16 | 8 | 509 | 138.90M | 4.62M | 736,195 | 96.8% | 642K | $36.97 | $2.18 | $39.15 |
| S17 | Experiment framework (v1 era) | Impl-stage execution, early tasks (3 adapter-writer subagents) | 11-05T00:23 | 9.3 | 4 | 3 | 187 | 42.43M | 1.77M | 284,337 | 96.0% | 488K | $12.36 | $1.36 | $13.72 |
| S18 | Experiment framework (v1 era) | Impl-stage execution, T6 driver onward, + 2 diff reviewers | 11-05T09:40 | 36.7 | 3 | 2 | 350 | 77.62M | 1.98M | 302,335 | 97.5% | 456K | $17.85 | $0.67 | $18.52 |
| S19 | Workflow/skill engineering | v2 skills redesign (spec/plan/exec lite v2) - 8 forked sessions | 11-06T21:59 | 8.7 | 8 | 0 | 84 | 15.70M | 1.13M | 112,735 | 93.3% | 239K | $7.23 | $0.00 | $7.23 |
| S20 | W7 product (v2 era) | W7 branch kickoff | 11-07T07:07 | 3.1 | 1 | 0 | 19 | 1.91M | 144K | 8,525 | 93.0% | 129K | $0.85 | $0.00 | $0.85 |
| S21 | Misc | Fold W2 into project state (sync-project-state skill) | 11-07T07:12 | 1.0 | 1 | 0 | 84 | 12.91M | 189K | 70,615 | 98.6% | 243K | $2.75 | $0.00 | $2.75 |
| S22 | W7 product (v2 era) | W7 spec -> plan -> orchestrated build -> review fixes -> live LLM test -> W7b spec+plan | 11-07T10:16 | 32.8 | 46 | 42 | 837 | 143.77M | 4.49M | 857,687 | 97.0% | 650K | $29.49 | $9.23 | $38.72 |
| S23 | W7 product (v2 era) | W7c link-UI: worktree setup, W7c spec + 3-lens review + plan review | 11-08T11:33 | 50.9 | 6 | 4 | 279 | 67.11M | 1.68M | 368,507 | 97.6% | 614K | $14.56 | $2.08 | $16.64 |
| S24 | Misc | /ponytail band (v5.3 check, web-fetch subagent) | 11-10T18:09 | 0.1 | 2 | 1 | 9 | 609K | 78K | 4,621 | 88.6% | 94K | $0.25 | $0.11 | $0.36 |
| S25 | Misc | This analysis (partial) | 11-10T19:50 | 0.0 | 1 | 0 | 14 | 1.33M | 85K | 13,843 | 94.0% | 131K | $0.61 | $0.00 | $0.61 |

### 3.1 Roll-up by context type (interactive Claude sessions only)

| Context type | Families | Cost | Share | Notes |
|---|---|---|---|---|
| Experiment framework (v1 era): spec, plan, build, impl-stage | S12, S16, S17, S18 | $79.87 | 40% | Spec → plan → build of the experiment harness itself, then its implementation stage. Built and run with **v1** skills. |
| W7 product work (v2 era) | S20, S22, S23 | $56.21 | 28% | PM plan flow: spec, plan, orchestrated build, live LLM test, W7b spec/plan, W7c spec/plan. Built with **v2** skills. |
| W10 UI design | S08, S09 | $22.99 | 12% | UI prototypes as Artifacts; the single most expensive *uncontrolled* session (S09: 371 calls, $18.59, peak ctx 562K). |
| Workflow / skill engineering | S04–S07, S19 | $22.17 | 11% | Designing and building the skill ecosystem, then v2. |
| Architecture & requirements | S01–S03 | $11.87 | 6% | Decision-round architecture work; an attached `context-engineering-resource-aware.md` was loaded in S01/S02/S04. |
| Misc (folds, ponytail band, small questions, this analysis) | S10, S11, S15, S21, S24, S25 | $4.17 | 2% | |
| Reviews of teammates' PRs (Claude) | S13, S14 | $2.42 | 1% | Most PR review went to Codex (§9). |
| **Experiment run clones (not a session)** | 149 log files | **$79.26** | n/a | §8.3 |

Reading it as "what did the money buy": **65% of all Claude spend went into the process and its measurement; 28% into product code.** That is appropriate for a course project about workflow, but it is the number a skeptical audience will ask about.

---

## 4. Context: size, cost and cache behaviour

### 4.1 Context per call

| Group | API calls | Median ctx/call | P90 | Max | Avg $/call | Median output/call | Mean output/call |
|---|---|---|---|---|---|---|---|
| Interactive main v1 (<=5 Nov) | 1962 | 213K | 429K | 642K | $0.063 | 554 | 1378 |
| Interactive main v2 (>=7 Nov) | 863 | 223K | 533K | 650K | $0.067 | 512 | 1155 |
| Interactive subagents v1 | 162 | 51K | 88K | 113K | $0.041 | 488 | 1590 |
| Interactive subagents v2 | 513 | 34K | 101K | 183K | $0.022 | 408 | 902 |
| Experiment main | 1517 | 96K | 202K | 314K | $0.032 | 363 | 973 |
| Experiment subagents | 669 | 73K | 199K | 328K | $0.046 | 751 | 1980 |

### 4.2 Cost climbs with context (main sessions)

| Context per call | Calls | Cost | Share of main cost | Avg $/call |
|---|---|---|---|---|
| 0K-100K | 178 | $9.31 | 5% | $0.052 |
| 100K-200K | 1059 | $47.08 | 26% | $0.044 |
| 200K-300K | 727 | $40.98 | 23% | $0.056 |
| 300K-400K | 389 | $26.98 | 15% | $0.069 |
| 400K-500K | 269 | $27.98 | 15% | $0.104 |
| 500K-600K | 135 | $15.03 | 8% | $0.111 |
| 600K+ | 68 | $14.27 | 8% | $0.210 |

Output per call is flat across these buckets (median ≈ 500 tokens), so the cost rise is almost all context: a step at 600K+ context costs about **4×** a step at 100–200K for the same amount of work. 861 calls (31%) sat above 300K and consumed 46% of main-session spend.

### 4.3 Cold-cache rebuilds after idle

When you come back to a main session after the 1-hour cache has expired, the first call re-writes the entire conversation at $4/M. Largest instances:

| UTC | Session | Idle gap (h) | Context re-written | 1h-cache write cost |
|---|---|---|---|---|
| 11-04T00:02 | 9a229a | 6.5 | 592K | $2.37 |
| 11-08T03:04 | 5eb330 | 9.0 | 579K | $2.32 |
| 11-03T16:46 | 441ac5 | 4.7 | 566K | $2.27 |
| 11-07T17:09 | 5eb330 | 1.1 | 501K | $2.00 |
| 11-03T10:49 | 441ac5 | 2.3 | 471K | $1.88 |
| 11-05T09:40 | 9b5d74 | 2.3 | 442K | $1.77 |
| 11-07T15:15 | 15f1dd | 1.0 | 430K | $1.72 |
| 11-06T03:39 | a99788 | 9.3 | 416K | $1.66 |
| 11-05T00:13 | 04a073 | 5.7 | 400K | $1.60 |
| 11-05T07:15 | 9b5d74 | 3.2 | 394K | $1.58 |
| 11-07T13:55 | 15f1dd | 2.2 | 362K | $1.45 |
| 11-05T16:10 | a99788 | 4.9 | 309K | $1.24 |

36 such returns (out of 42 gaps over an hour) re-wrote 8.35M tokens for **$33.41**, an average **$0.93 per return**, with the worst around $2.4 each. This is a habit across many sessions, not a few outliers: a 600K-token session left overnight costs about $2.4 to resume before it does any work.

### 4.4 Continuations and compaction

* At least six logs begin with an injected summary from a context-exhausted predecessor (the W10 UI chain, the W7 chain, three experiment-build continuations). Compaction events in the raw logs: S02 ×2, S07 ×1, S08 ×1, S09 ×5, S22 ×3.
* Session titles hide scope. The family titled "W7 spec" (S22) spans **32.8 hours, 837 calls, 46 log files and $38.72** and covers spec → plan → build → review fixes → live LLM test → the *next* spec and plan. A single long thread grew to 650K tokens. This is a context-engineering counter-example next to the clean hand-offs the plan structure is designed for.

---

## 5. Subagents: what they did and what they cost

71 interactive subagents ran (every one on `claude-sonnet-5-5`; `workflow/models.json` has all three tiers pointing at the same model, so no model routing was ever exercised).

### 5.1 By role and era

| Role | Era | Agents | API calls | Cache read | Cache write (5m) | Output | Cost | Cost / agent | Peak ctx |
|---|---|---|---|---|---|---|---|---|---|
| Reviewer - spec review (lens) | all | 22 | 128 | 2.60M | 817K | 228K | $4.58 | $0.21 | 70K |
| Reviewer - plan review | all | 5 | 100 | 9.25M | 555K | 114K | $3.45 | $0.69 | 183K |
| Implementer - task implementation | all | 9 | 170 | 6.95M | 404K | 151K | $3.22 | $0.36 | 108K |
| General-purpose - adapter writing | all | 3 | 32 | 2.28M | 291K | 41K | $1.36 | $0.45 | 106K |
| Implementer - review-fix round | all | 7 | 91 | 2.35M | 213K | 58K | $1.35 | $0.19 | 52K |
| Implementer - retry/continue | all | 2 | 53 | 3.21M | 167K | 46K | $1.20 | $0.60 | 97K |
| Reviewer - per-task review | all | 15 | 50 | 410K | 238K | 37K | $1.00 | $0.07 | 34K |
| General-purpose - skill fixture test | all | 3 | 21 | 1.29M | 243K | 14K | $0.88 | $0.29 | 84K |
| Reviewer - branch/diff review | all | 2 | 18 | 677K | 132K | 27K | $0.67 | $0.33 | 83K |
| General-purpose - run continuation | all | 2 | 10 | 440K | 73K | 2K | $0.25 | $0.12 | 54K |
| Web-fetch | all | 1 | 2 | 4K | 39K | 2K | $0.11 | $0.11 | 39K |
| Reviewer - spec review (lens) | v1 | 12 | 59 | 996K | 443K | 143K | $2.64 | $0.22 | 70K |
| General-purpose - adapter writing | v1 | 3 | 32 | 2.28M | 291K | 41K | $1.36 | $0.45 | 106K |
| General-purpose - skill fixture test | v1 | 3 | 21 | 1.29M | 243K | 14K | $0.88 | $0.29 | 84K |
| Reviewer - plan review | v1 | 2 | 22 | 1.24M | 171K | 30K | $0.85 | $0.43 | 113K |
| Reviewer - branch/diff review | v1 | 2 | 18 | 677K | 132K | 27K | $0.67 | $0.33 | 83K |
| General-purpose - run continuation | v1 | 2 | 10 | 440K | 73K | 2K | $0.25 | $0.12 | 54K |
| Implementer - task implementation | v2 | 9 | 170 | 6.95M | 404K | 151K | $3.22 | $0.36 | 108K |
| Reviewer - plan review | v2 | 3 | 78 | 8.00M | 384K | 84K | $2.60 | $0.87 | 183K |
| Reviewer - spec review (lens) | v2 | 10 | 69 | 1.60M | 374K | 85K | $1.94 | $0.19 | 51K |
| Implementer - review-fix round | v2 | 7 | 91 | 2.35M | 213K | 58K | $1.35 | $0.19 | 52K |
| Implementer - retry/continue | v2 | 2 | 53 | 3.21M | 167K | 46K | $1.20 | $0.60 | 97K |
| Reviewer - per-task review | v2 | 15 | 50 | 410K | 238K | 37K | $1.00 | $0.07 | 34K |
| Web-fetch | v2 | 1 | 2 | 4K | 39K | 2K | $0.11 | $0.11 | 39K |

### 5.2 Review lenses

| Era | Lens / scope | Reviews | Total cost | Avg cost | Avg output tokens |
|---|---|---|---|---|---|
| v1 | attacker | 5 | $1.28 | $0.26 | 13,346 |
| v1 | implementer | 6 | $1.47 | $0.24 | 11,999 |
| v1 | plan review (whole folder) | 2 | $0.85 | $0.43 | 15,104 |
| v1 | tester | 3 | $0.56 | $0.19 | 10,512 |
| v2 | all lenses | 1 | $0.09 | $0.09 | 3,171 |
| v2 | attacker | 7 | $0.78 | $0.11 | 4,911 |
| v2 | combined | 2 | $0.25 | $0.13 | 4,075 |
| v2 | implementer | 7 | $0.87 | $0.12 | 5,063 |
| v2 | maintainer | 1 | $0.17 | $0.17 | 5,818 |
| v2 | plan review (whole folder) | 3 | $2.60 | $0.87 | 27,962 |
| v2 | tester | 7 | $0.78 | $0.11 | 4,909 |

### 5.3 Observations

* **Implementation and review subagents are cheap and bounded.** A typical implementer: 8–38 calls, peak context 18–108K, $0.04–$0.88. A typical lens reviewer: 3–9 calls, peak context 10–51K, $0.02–$0.39.
* **Plan reviewers are the exception and the cost grows with the plan folder:** $0.26 (v1 single plan, peak 57K) → $0.28 (W7, 68K) → $0.59 (v1 impl-stage plan, 113K) → $0.90 (W7b, 133K) → **$1.42 (W7c, 183K, 46 calls)**. The router-plus-task-files layout limits what an *implementer* reads; the plan reviewer reads the whole folder plus the spec and code (§10, B4).
* **v1 → v2 subagent context shrank** (median 51K → 34K per call; average $/call $0.041 → $0.022; see §4.1), consistent with implementers reading only their own task file. The main orchestrator did not shrink (§7.3).
* **v2 lens reviews are about half the price of v1 lens reviews:** $0.19 vs $0.22 average across all spec-review lenses, but the three lenses that exist in both eras (Implementer, Tester, Attacker) average $0.11–0.12 in v2 against $0.19–0.26 in v1, and write 4.9–5.1K output tokens per review against 10.5–13.3K. Two review rounds in v1 became one in v2, and the v2 spec being reviewed is smaller (§7.2).
* **Subagent work is a small share of interactive spend (9%)** because the expensive part of orchestration is the orchestrator's carried context, not the workers.
* Non-code subagents: 3 fixture-test agents validating the v1 skills (S07), 3 adapter-writing agents (S17), 2 harness-run continuation agents, 1 `web-fetch` (S24, Haiku-class, $0.11).

### 5.4 Cross-check against the repo's own Phase-1 measurement

`docs/skill-ecosystem-phase1-test.md` (31 Oct) reports 78,055 / 83,251 / 85,765 total tokens for its three fixture-test subagents ("includes harness baseline"). The logs show those same three agents at peak contexts of 76,937 / 82,070 / 84,091 tokens, 6–8 calls each, $0.27 / $0.29 / $0.33. The repo's number is a context size, not an incremental skill cost, as its own caveat says.

### 5.5 Full list (interactive subagents)

| UTC start | Parent | Type | Description | Activity | Era | Calls | 1st-call ctx | Peak ctx | Cache read | Cache write | Output | Cost |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 10-30T18:17 | 254801 | general-purpose | Test 1: branch session and small fix | skill fixture test | v1 | 6 | 60K | 77K | 341K | 77K | 4K | $0.27 |
| 10-30T18:17 | 254801 | general-purpose | Test 3: fold approved branch state | skill fixture test | v1 | 8 | 60K | 84K | 519K | 84K | 6K | $0.33 |
| 10-30T18:17 | 254801 | general-purpose | Test 2: guardrail collision request | skill fixture test | v1 | 7 | 60K | 82K | 431K | 82K | 4K | $0.29 |
| 11-01T07:28 | 8c44db | reviewer | Implementer review of W10 spec | spec review (lens) | v1 | 7 | 8K | 70K | 204K | 70K | 20K | $0.39 |
| 11-03T02:03 | be3c73 | reviewer | Implementer lens spec review | spec review (lens) | v1 | 3 | 7K | 23K | 18K | 23K | 11K | $0.17 |
| 11-03T02:03 | be3c73 | reviewer | Tester lens spec review | spec review (lens) | v1 | 3 | 7K | 23K | 18K | 23K | 7K | $0.13 |
| 11-03T02:03 | be3c73 | reviewer | Attacker lens spec review | spec review (lens) | v1 | 3 | 7K | 22K | 19K | 22K | 9K | $0.14 |
| 11-03T02:09 | be3c73 | reviewer | Round 2 Implementer review | spec review (lens) | v1 | 3 | 7K | 32K | 20K | 32K | 7K | $0.16 |
| 11-03T02:09 | be3c73 | reviewer | Round 2 Attacker review | spec review (lens) | v1 | 6 | 7K | 30K | 87K | 30K | 8K | $0.16 |
| 11-03T02:09 | be3c73 | reviewer | Round 2 Tester review | spec review (lens) | v1 | 5 | 7K | 30K | 65K | 30K | 6K | $0.14 |
| 11-03T06:04 | 66288f | reviewer | Review the experiment plan | plan review | v1 | 8 | 7K | 57K | 290K | 57K | 9K | $0.26 |
| 11-04T00:52 | 15ed62 | general-purpose | Continue paused full-r2 run | run continuation | v1 | 3 | 48K | 51K | 98K | 51K | 1K | $0.15 |
| 11-04T00:54 | 53f8a8 | general-purpose | Continue paused full-r2 run | run continuation | v1 | 7 | 48K | 54K | 342K | 22K | 1K | $0.10 |
| 11-04T17:50 | 04a073 | reviewer | Review spec: Implementer lens | spec review (lens) | v1 | 9 | 7K | 51K | 241K | 51K | 16K | $0.31 |
| 11-04T17:50 | 04a073 | reviewer | Review spec: Attacker lens | spec review (lens) | v1 | 7 | 7K | 42K | 142K | 42K | 16K | $0.27 |
| 11-04T17:50 | 04a073 | reviewer | Review spec: Tester lens | spec review (lens) | v1 | 5 | 7K | 39K | 85K | 39K | 19K | $0.30 |
| 11-04T17:59 | 04a073 | reviewer | Spec review round 2: Implementer | spec review (lens) | v1 | 4 | 7K | 45K | 54K | 45K | 10K | $0.22 |
| 11-04T17:59 | 04a073 | reviewer | Spec review round 2: Attacker | spec review (lens) | v1 | 4 | 8K | 36K | 43K | 36K | 16K | $0.25 |
| 11-04T18:17 | 04a073 | reviewer | Review plan: logic and repo seams | plan review | v1 | 14 | 8K | 113K | 954K | 113K | 21K | $0.59 |
| 11-05T03:52 | 9b5d74 | general-purpose | Write superpowers-r2 adapter | adapter writing | v1 | 12 | 50K | 90K | 856K | 90K | 13K | $0.44 |
| 11-05T03:52 | 9b5d74 | general-purpose | Write full-r2 adapter | adapter writing | v1 | 10 | 50K | 106K | 735K | 106K | 15K | $0.49 |
| 11-05T03:52 | 9b5d74 | general-purpose | Write lite-r2 adapter | adapter writing | v1 | 10 | 50K | 96K | 694K | 96K | 13K | $0.44 |
| 11-06T15:47 | a99788 | reviewer | Review impl-stage diff (Attacker) | branch/diff review | v1 | 10 | 8K | 83K | 463K | 83K | 19K | $0.44 |
| 11-06T15:47 | a99788 | reviewer | Review impl-stage diff (Implementer) | branch/diff review | v1 | 8 | 8K | 49K | 214K | 49K | 8K | $0.22 |
| 11-07T11:08 | e60e88 | reviewer | Attacker lens review | spec review (lens) | v2 | 6 | 7K | 40K | 142K | 40K | 7K | $0.19 |
| 11-07T11:08 | e60e88 | reviewer | Maintainer lens review | spec review (lens) | v2 | 6 | 7K | 40K | 139K | 40K | 6K | $0.17 |
| 11-07T11:08 | e60e88 | reviewer | Tester lens review | spec review (lens) | v2 | 4 | 7K | 33K | 66K | 33K | 7K | $0.16 |
| 11-07T11:09 | e60e88 | reviewer | Implementer lens review (retry) | spec review (lens) | v2 | 6 | 7K | 36K | 136K | 32K | 5K | $0.15 |
| 11-07T11:37 | 15f1dd | reviewer | Review W7 plan folder | plan review | v2 | 4 | 7K | 68K | 105K | 68K | 10K | $0.28 |
| 11-07T13:57 | 15f1dd | implementer | Implement W7 task T2 | task implementation | v2 | 8 | 10K | 19K | 105K | 19K | 4K | $0.10 |
| 11-07T13:59 | 15f1dd | reviewer | T2 review Tester lens | per-task review | v2 | 4 | 7K | 13K | 30K | 13K | 2K | $0.06 |
| 11-07T13:59 | 15f1dd | reviewer | T2 review Attacker lens | per-task review | v2 | 4 | 7K | 11K | 31K | 7K | 2K | $0.04 |
| 11-07T13:59 | 15f1dd | reviewer | T2 review Implementer lens | per-task review | v2 | 4 | 7K | 14K | 37K | 10K | 3K | $0.06 |
| 11-07T14:00 | 15f1dd | implementer | Implement W7 task T3 | task implementation | v2 | 14 | 11K | 25K | 261K | 20K | 5K | $0.12 |
| 11-07T14:04 | 15f1dd | reviewer | T3 review Implementer lens | per-task review | v2 | 3 | 7K | 16K | 27K | 12K | 1K | $0.05 |
| 11-07T14:04 | 15f1dd | reviewer | T3 review Attacker lens | per-task review | v2 | 3 | 7K | 8K | 19K | 4K | 1K | $0.02 |
| 11-07T14:04 | 15f1dd | reviewer | T3 review Tester lens | per-task review | v2 | 2 | 7K | 17K | 11K | 13K | 1K | $0.04 |
| 11-07T14:05 | 15f1dd | implementer | T3 review fix round | review-fix round | v2 | 8 | 10K | 25K | 151K | 19K | 5K | $0.11 |
| 11-07T14:06 | 15f1dd | implementer | Implement W7 task T1 | task implementation | v2 | 15 | 11K | 34K | 367K | 29K | 7K | $0.18 |
| 11-07T14:10 | 15f1dd | reviewer | T1 review Tester lens | per-task review | v2 | 2 | 7K | 15K | 7K | 15K | 2K | $0.05 |
| 11-07T14:10 | 15f1dd | reviewer | T1 review Attacker lens | per-task review | v2 | 3 | 7K | 16K | 22K | 16K | 2K | $0.07 |
| 11-07T14:10 | 15f1dd | reviewer | T1 review Implementer lens | per-task review | v2 | 4 | 7K | 21K | 43K | 21K | 3K | $0.09 |
| 11-07T14:11 | 15f1dd | implementer | T1 review fix round | review-fix round | v2 | 10 | 10K | 25K | 185K | 19K | 7K | $0.13 |
| 11-07T15:28 | 5eb330 | implementer | T1 fix round 2 against real DB | review-fix round | v2 | 15 | 10K | 32K | 354K | 32K | 6K | $0.18 |
| 11-07T15:31 | 5eb330 | implementer | Implement W7 task T4 | task implementation | v2 | 13 | 11K | 36K | 327K | 31K | 15K | $0.26 |
| 11-07T15:34 | 5eb330 | reviewer | T4 review Attacker lens | per-task review | v2 | 4 | 7K | 12K | 33K | 9K | 2K | $0.04 |
| 11-07T15:34 | 5eb330 | reviewer | T4 review Tester lens | per-task review | v2 | 3 | 8K | 17K | 22K | 17K | 4K | $0.08 |
| 11-07T15:34 | 5eb330 | reviewer | T4 review Implementer lens | per-task review | v2 | 4 | 7K | 16K | 41K | 13K | 3K | $0.06 |
| 11-07T15:35 | 5eb330 | implementer | T4 review fix round | review-fix round | v2 | 17 | 10K | 39K | 490K | 33K | 14K | $0.27 |
| 11-07T15:38 | 5eb330 | implementer | Implement W7 task T5 | task implementation | v2 | 16 | 11K | 43K | 468K | 37K | 14K | $0.28 |
| 11-07T15:41 | 5eb330 | reviewer | T5 light review (all lenses) | per-task review | v2 | 4 | 8K | 21K | 41K | 21K | 3K | $0.09 |
| 11-07T15:42 | 5eb330 | implementer | Implement W7 tasks T8 and T9 | task implementation | v2 | 34 | 11K | 75K | 1.40M | 70K | 29K | $0.61 |
| 11-07T15:50 | 5eb330 | implementer | Implement W7 tasks T6 and T7 | task implementation | v2 | 30 | 12K | 90K | 1.49M | 85K | 40K | $0.76 |
| 11-07T15:59 | 5eb330 | reviewer | T6+T7 combined light review | per-task review | v2 | 3 | 8K | 34K | 24K | 34K | 4K | $0.13 |
| 11-07T16:00 | 5eb330 | implementer | Implement W7 task T10 | task implementation | v2 | 2 | 12K | 18K | 18K | 12K | 0K | $0.04 |
| 11-07T17:09 | 5eb330 | implementer | Implement W7 task T10 (retry) | retry/continue | v2 | 19 | 12K | 70K | 855K | 70K | 15K | $0.41 |
| 11-07T17:31 | 5eb330 | implementer | Continue W7 task T10 | retry/continue | v2 | 34 | 12K | 97K | 2.35M | 97K | 31K | $0.79 |
| 11-07T17:41 | 5eb330 | implementer | Implement W7 task T11 | task implementation | v2 | 38 | 12K | 108K | 2.52M | 103K | 37K | $0.88 |
| 11-07T17:51 | 5eb330 | reviewer | T10+T11 combined light review | per-task review | v2 | 3 | 8K | 33K | 24K | 33K | 4K | $0.13 |
| 11-07T17:52 | 5eb330 | implementer | T10/T11 review fix round | review-fix round | v2 | 22 | 11K | 52K | 717K | 46K | 12K | $0.31 |
| 11-08T03:04 | 5eb330 | implementer | Fix review findings batch A | review-fix round | v2 | 10 | 10K | 42K | 282K | 42K | 8K | $0.22 |
| 11-08T03:07 | 5eb330 | implementer | Fix review findings batch B | review-fix round | v2 | 9 | 10K | 27K | 173K | 21K | 6K | $0.13 |
| 11-08T17:29 | b59463 | reviewer | Tester-lens spec review | spec review (lens) | v2 | 7 | 7K | 26K | 114K | 26K | 9K | $0.16 |
| 11-08T17:29 | b59463 | reviewer | Implementer-lens spec review | spec review (lens) | v2 | 5 | 7K | 36K | 76K | 36K | 9K | $0.19 |
| 11-08T17:29 | b59463 | reviewer | Attacker-lens spec review | spec review (lens) | v2 | 9 | 7K | 44K | 232K | 44K | 13K | $0.27 |
| 11-08T18:21 | b59463 | reviewer | Plan review for W7b | plan review | v2 | 28 | 8K | 133K | 2.37M | 133K | 33K | $0.90 |
| 11-10T12:21 | d461b0 | reviewer | Tester lens review of W7c spec | spec review (lens) | v2 | 8 | 8K | 38K | 192K | 38K | 10K | $0.21 |
| 11-10T12:21 | d461b0 | reviewer | Attacker lens review of W7c spec | spec review (lens) | v2 | 5 | 8K | 34K | 81K | 34K | 6K | $0.16 |
| 11-10T12:21 | d461b0 | reviewer | Implementer lens review of W7c spec | spec review (lens) | v2 | 13 | 8K | 51K | 426K | 51K | 12K | $0.29 |
| 11-10T13:50 | d461b0 | reviewer | Review W7c plan folder | plan review | v2 | 46 | 8K | 183K | 5.53M | 183K | 41K | $1.42 |
| 11-10T18:14 | cc0da3 | web-fetch | Check ponytail repo releases for v5.3 band/board |  | v2 | 2 | 4K | 39K | 4K | 39K | 2K | $0.11 |

---

## 6. Lifecycle cost: what spec → plan → build → review cost

Phases are cut at your own approval messages (UTC), main-session and subagent calls combined. They are *calendar windows*, so any idle-return rebuild that falls inside a window is included.

### 6.1 W7, the v2 flow end to end (S22)

| Phase (UTC 7-8 Nov) | Calls | Main $ | Subagent $ | Total $ | Cache read | Cache write | Output | Peak main ctx |
|---|---|---|---|---|---|---|---|---|
| A. W7 spec: draft + 4-lens review (+1 retry) + fixes | 88 | $3.22 | $0.67 | $3.89 | 13.81M | 387K | 118K | 296K |
| B. W7 plan: write plan folder + 1 plan reviewer | 38 | $2.36 | $0.28 | $2.65 | 11.75M | 183K | 84K | 408K |
| C1. Build T1-T4 (+fix rounds), 3-lens review per task | 218 | $7.42 | $2.06 | $9.48 | 36.11M | 1.26M | 136K | 514K |
| C2. Build T5-T11 (+fix rounds), light/combined review | 253 | $5.78 | $4.36 | $10.15 | 37.70M | 1.20M | 246K | 624K |
| D. Post-build: fix review findings, summary, PR text | 43 | $4.09 | $0.35 | $4.45 | 14.07M | 704K | 32K | 650K |
| E. Live-LLM test, scope Q&A, gap discussion | 87 | $2.83 | $0.00 | $2.83 | 12.48M | 269K | 51K | 204K |
| F. W7b spec + 3-lens review | 49 | $1.45 | $0.61 | $2.06 | 5.27M | 214K | 84K | 234K |
| G. W7b plan + plan reviewer + approval | 61 | $2.33 | $0.90 | $3.22 | 12.58M | 272K | 107K | 373K |

Build phases only (13:55Z 7 Nov → 03:03Z 8 Nov), who spent what:

| Who | Calls | Cost | Share |
|---|---|---|---|
| Orchestrator (main) | 126 | $13.20 | 67% |
| Implementer - task implementation | 170 | $3.22 | 16% |
| Implementer - retry/continue | 53 | $1.20 | 6% |
| Reviewer - per-task review | 50 | $1.00 | 5% |
| Implementer - review-fix round | 72 | $1.00 | 5% |

**The orchestrator is two-thirds of the build.** 126 orchestrator calls (context 400–650K) cost $13.20; 170 implementer calls cost $3.22. Reviewer subagents for all tasks cost $1.00 in total.

Your instruction at **15:39Z**, *"for future implementation, only run the review agents for non-trivial work, and combine a few tests together. we already reviewed the spec thoroughly"*, is visible in the logs: T1–T4 each got three lens reviewers (≈$0.11–0.21 per task); T5, T6+T7 and T10+T11 each got one combined light reviewer ($0.09, $0.13, $0.13). That is real, evidence-backed resource-aware steering, but it targeted the smallest line (reviewers ≈ 5% of build cost). The largest line (orchestrator context) was untouched.

### 6.2 v1: experiment framework spec and plan (S12)

| Phase (UTC) | Calls | Main $ | Subagent $ | Total $ | Cache read | Cache write | Output | Peak main ctx |
|---|---|---|---|---|---|---|---|---|
| Design discussion, worktree/experiment strategy | 13 | $0.55 | $0.00 | $0.55 | 1.03M | 84K | 11K | 99K |
| Spec (writing-specs-lite v1) + review rounds 1-2 + approval | 101 | $5.11 | $0.90 | $6.01 | 16.78M | 689K | 181K | 327K |
| Plan (writing-plans-lite v1) + plan review + approval | 26 | $1.65 | $0.26 | $1.92 | 7.08M | 146K | 71K | 415K |

The spec window includes two review rounds × three lenses (six reviewers, $0.90) and a ~3-hour idle gap (cache rebuilt once).

### 6.3 v1: experiment build, pilot operation, then impl-stage spec and plan (S16)

| Phase (UTC) | Calls | Main $ | Subagent $ | Total $ | Cache read | Cache write | Output | Peak main ctx |
|---|---|---|---|---|---|---|---|---|
| P1. Build experiment framework T1-T10 (executing-plans-lite v1) | 202 | $14.26 | $0.00 | $14.26 | 67.04M | 987K | 361K | 576K |
| P2. Pilot orchestration, crash debugging, analysis, report | 163 | $14.84 | $0.25 | $15.09 | 38.54M | 2.60M | 95K | 642K |
| P3. Impl-stage spec (writing-specs-lite v1) + 2 review rounds | 74 | $2.83 | $1.35 | $4.18 | 10.57M | 394K | 186K | 311K |
| P4. Impl-stage plan (writing-plans-lite v1) + plan review + hand-off | 70 | $5.03 | $0.59 | $5.62 | 22.76M | 645K | 93K | 444K |

### 6.4 v2: W7c link-UI (S23)

| Phase (UTC) | Calls | Main $ | Subagent $ | Total $ | Cache read | Cache write | Output | Peak main ctx |
|---|---|---|---|---|---|---|---|---|
| Worktree setup, LLM_MODE wiring, manual UI tests, W7c requirements | 128 | $7.77 | $0.00 | $7.77 | 23.72M | 1.06M | 114K | 309K |
| W7c spec (writing-specs-lite-v2) + 3-lens review | 62 | $2.82 | $0.66 | $3.48 | 14.14M | 273K | 116K | 459K |
| W7c plan + plan-folder review + hand-off to Codex | 89 | $3.96 | $1.42 | $5.38 | 29.26M | 338K | 138K | 614K |

The W7c *implementation* was delegated to a Codex orchestrator (§9): "Approve plan but I will implement using another agent. give me the starting prompt for that."

---

## 7. v1 (`*-lite`) vs v2 (`*-lite-v2`)

### 7.1 Is there a direct comparison?

**No controlled one.** The experiment (§8) compared `superpowers` vs `lite` (v1 spec/plan skills) vs `full`; it has no v2 arm, because v2 was designed *in response* to it (the v2 session opens 6 Nov 21:59Z; the experiment report's own §10 addendum is dated 7 Nov). Nothing in the repo or the logs runs the same task through v1 and v2. What does exist are four partial proxies:

| # | Proxy | Strength | Weakness |
|---|---|---|---|
| 1 | **Experiment: v1 lite vs superpowers vs full**, plan stage, same task, 3 replicates | Controlled, same model, costed | v1 only; this is the *problem statement* for v2 |
| 2 | **Same operator, same repo, same kind of artifact, before/after** (spec and plan lifecycles §7.2, build §7.3) | Real work, real tokens | Different features each time, n=2 vs n=3, review policy also changed |
| 3 | **Artifact size** of specs and plans per skill version (§7.4) | Measures the *design intent* directly | Size ≠ tokens; includes teammates' work |
| 4 | **Subagent context and cost** before/after (§4.1, §5) | Many calls; shows the "read only your task file" effect | Mixed roles |

### 7.2 Spec and plan lifecycles, side by side

Cost = main-session + reviewer subagents over the lifecycle window (§6). Artifact = what was written to `workflow/specs` / `workflow/plans`.

| Lifecycle | Skill | Spec lifecycle cost (calls) | Spec artifact | Review shape | Plan lifecycle cost (calls) | Plan artifact | Plan reviewer (cost / peak ctx) |
|---|---|---|---|---|---|---|---|
| Experiment framework (S12) | v1 | $6.01 (101) | 8 files, 67 KB | 2 rounds × 3 lenses (6 reviewers, $0.90) | $1.92 (26) | 1 file, 43 KB | $0.26 / 57K |
| Impl-stage (S16) | v1 | $4.18 (74) | 6 files, 82 KB | 2 rounds, 5 reviewers ($1.35) | $5.62 (70) * | 1 file, 43 KB | $0.59 / 113K |
| W7 PM plan flow (S22) | **v2** | **$3.89** (88) | **1 file, 44 KB** | 1 round × 4 lenses (+1 retry, $0.67) | $2.65 (38) | 12 files, 85 KB (plus 11 handover files written at build time) | $0.28 / 68K |
| W7b plan editing (S22) | **v2** | **$2.06** (49) | **1 file, 30 KB** | 1 round × 3 lenses ($0.61) | $3.22 (61) | 9 files, 68 KB (plus 9 build-time handover/audit files) | $0.90 / 133K |
| W7c link-UI (S23) | **v2** | $3.48 (62) | n/a (on another branch) | 1 round × 3 lenses ($0.66) | $5.38 (89) * | n/a | $1.42 / 183K |

\* Window includes the hand-off conversation after the plan; treat as an upper bound.

What this supports (n = 2 for v1 vs 3 for v2, different features, so *directionally*):
* **v2 specs cost about 40% less to write and review** (v1 average $5.10 vs v2 average $3.14 over three) and are 35–50% smaller (44 KB / 30 KB vs 67–82 KB).
* **v2 plans are not cheaper**: authored plan text is 1.6–2× larger (68–85 KB vs 43 KB) because the plan carries the per-task files, and plan reviewers cost 1–5× more. The saving, if any, is supposed to land at execution time. (Correction, 11 Nov: an earlier version counted the build-time `handovers/` files, 15–16 KB per plan, as plan size; they are execution output, not authored plan.)

### 7.3 Execution: v1 `executing-plans-lite` vs v2 orchestrator

| | v1 build of experiment framework (S16 P1) | v1 impl-stage build (S17 + S18) | v2 W7 build (S22 C + D) |
|---|---|---|---|
| Plan tasks | T1–T10 | T1–T8 | T1–T11 |
| Who did the work | Main session only (0 subagents) | Main session + 3 adapter writers + 2 diff reviewers | Orchestrator + 18 implementer agents + 15 task reviewers |
| Cost | $14.26 | $32.24 (includes running the experiment) | $24.08 (build $19.63 + review-fix/PR text $4.45) |
| Per task | ≈ $1.43 | ≈ $4.03 | ≈ $2.19 |
| Main-session peak context | 576K | 488K | **650K** |
| Subagent share of cost | 0% | 6% | 28% |

Across *all* v1-era vs v2-era main calls, median context is 213K → 223K and p90 429K → 533K (§4.1).

**Honest reading:** v2 orchestration did not reduce total cost per task against the v1 harness build, and it did not reduce main-session context. What it changed is *where* tokens are spent: 28% of build cost sits in small fresh-context subagents (median ctx 34K) rather than 0–6%, and the work is parallelisable and resumable by artifact. The tasks differ (harness code vs backend with a real database; v2 spent extra rounds on Postgres test setup and a 9-hour idle gap that cost a $2.35 cache rebuild), so no per-task conclusion should be quoted without that caveat.

### 7.4 Artifact and skill sizes (design intent)

| Spec/plan artifacts | Skill version | Spec | Plan |
|---|---|---|---|
| Experiment framework | v1 | folder 58 KB (7 files) + 9 KB index | 43 KB, 1 file |
| Impl-stage | v1 | folder 71 KB (5 files) + 10 KB index | 43 KB, 1 file |
| W2 gateway | v1 | folder 49 KB (6) + 9 KB | 24 KB |
| W3 guards | v1 | folder 41 KB (5) + 9 KB | 15 KB |
| W6 AI context | v1 | folder 41 KB (5) + 9 KB | 12 KB |
| W4 auth | v1 | folder 34 KB (8) + 7 KB | 33 KB |
| **v1 average** | | **≈ 58 KB** | **≈ 28 KB** |
| W5 core planning | **v2** | single file 35 KB | plan.md 4 KB + 6 task files avg 3.5 KB = 25 KB |
| W7 PM plan flow | **v2** | single file 44 KB | plan.md 9 KB + 11 task files avg 6.9 KB = 85 KB (max task 12.6 KB) |
| W7b PM plan editing | **v2** | single file 30 KB | plan.md 10 KB + 8 task files avg 7.3 KB = 68 KB |
| **v2 average** | | **≈ 36 KB (−37%)** | **≈ 59 KB authored (+110%)**; each implementer reads one 3.5–12.6 KB task file |

(W2, W3, W4, W5 and W6 were authored by teammates; no token log exists for them.)

| Skill (SKILL.md, bytes ÷ 4 ≈ tokens *est.*) | v1 | v2 |
|---|---|---|
| writing-specs-lite | 17.6 KB ≈ 4.5K (11 files, 38 KB total) | 11.4 KB ≈ 2.9K (4 files, 36 KB total) |
| writing-plans-lite | 11.4 KB ≈ 2.9K (2 files) | 8.4 KB ≈ 2.1K (3 files) |
| executing-plans-lite | 7.5 KB ≈ 1.9K | 10.4 KB ≈ 2.7K |
| **Spec + plan + exec SKILL.md** | **36.5 KB ≈ 9.3K tokens** | **30.2 KB ≈ 7.7K tokens** |

The v2 skills are about 17% lighter to load, and the executing skill grew because it now carries orchestration logic.

### 7.5 What the v2 redesign was *for*, in your words (6 Nov 21:59Z)

> "the spec skill spends too much tokens and work splitting a new feature into dedicated subfiles that the operator can review […] The original intention was that the agents will only need to read the relevant sections, but that turns out not to be true, as the implementors more or less only read the plan anyway, so they are still re-reading a huge plan file. From observation, the plans written by my lite skill also tend to be larger than that by superpowers […] The plan will be the one that splits into dedicated subfiles […] The executing plans skill then becomes a skill that orchestrates a session to implement the plan."

This is a measured hypothesis from §8: lite's spec-and-plan package was about 3× the words and 5× the cost of superpowers' for +4 rubric points, and the builder skipped ≈ 41 KB of spec files only because its prompt said the plan was the specification.

---

### 7.6 Can plan size justify a v2 cost saving? No; here is what can be justified

A bigger v2 plan (≈ 59 KB authored vs ≈ 28 KB, +110%) cannot be argued as a saving, and plan size is not where build cost sits either way:

* **Reading the plan is nearly free.** A v1 plan of 43 KB ≈ 10.8K tokens carried through a 202-call v1 build costs ≈ $0.26 (one 1-hour cache write plus cache reads at $0.10/M), 1.8% of that $14.26 build; for the 537-call impl-stage build ≈ $0.62 (1.9%). A v2 implementer reads one 3.5–12.6 KB task file plus the pasted Shared context ≈ 4K tokens. The *difference* is therefore worth well under $1 per build, less than the extra authoring and plan-review cost of v2 (+$0.7–1.3 for the plan lifecycle, plus a dearer plan reviewer, §7.2).
* **What the data does support (directional, n=2 vs 3):** the *combined* spec + plan lifecycle (writing, review rounds, approval) averaged **$8.87 in v1** ($7.93 and $9.80) against **$6.89 in v2** ($6.54, $5.28, $8.86), about **22% cheaper**, because the spec saving (≈ $2) exceeds the plan increase (≈ $1). Two of the five windows (impl-stage plan, W7c plan) include hand-off conversation, so treat both averages as upper bounds.
* **What v2 was designed to change is per-agent reading, not total text:** a v1 build agent re-reads one 43 KB plan (the experiment saw superpowers builders read both files twice), while a v2 implementer reads 4–13 KB and its context peaked at 18–108K (median 34K per call against 217K for main sessions, §4.1). That is a context-hygiene and resumability benefit, which the logs show; a total-cost benefit they do not (§7.3).
* **How to word it:** "v2 trades a larger authored plan for a smaller per-agent read. Per feature, spec + plan cost about 22% less; build cost per task was not lower."

## 8. The experiment (v1 `lite` vs `superpowers` vs `full`)

Framework: `workflow/experiments/`. Task `pilot-pinned-note`, model `claude-sonnet-5-5`, one isolated clone per run. Arms: `superpowers` (stock plugin), `lite` (v1 `writing-specs-lite` + `writing-plans-lite`, one Implementer-lens review), `full` (lite plus dedicated spec-writer, reviewer and planner subagents, up to two review rounds). The experiment definition set ceilings of $25/run and $100/batch; during the run you set a $10 cap, then relaxed it, then asked to run only one `full` run to completion.

### 8.1 Plan stage: official per-run records (`docs/telemetry/experiments/runs.csv`)

| Arm | Rep | Status | Wall (s) | Fresh in | Output | Cache read | Cache write | Peak prompt | Cache-read share | Arm cost | Questions | Issues found | Rubric /40 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| superpowers | 1 | complete | 115 | 20 | 11K | 352K | 35K | 51K | 91.0% | $0.28 | 1 | 7 | 28.5 |
| superpowers | 2 | complete | 147 | 22 | 14K | 408K | 42K | 59K | 90.6% | $0.35 | 1 | 7 | 28.5 |
| superpowers | 3 | complete | 131 | 20 | 12K | 354K | 38K | 54K | 90.3% | $0.31 | 1 | 6 | 31 |
| lite | 1 | complete | 551 | 80 | 61K | 2.34M | 170K | 130K | 93.2% | $1.44 | 1 | 7 | 32 |
| lite | 2 | complete | 642 | 84 | 70K | 3.37M | 193K | 163K | 94.6% | $1.74 | 1 | 7 | 32.5 |
| lite | 3 | complete | 622 | 92 | 68K | 3.16M | 175K | 141K | 94.7% | $1.63 | 2 | 7 | 33 |
| full | 1 | complete | 24686 | 392 | 305K | 20.60M | 1.39M | 328K | 93.7% | $8.81 | 3 | 7 | 35.5 |
| full | 2 | complete | 1474 | 230 | 200K | 9.79M | 573K | 259K | 94.5% | $4.49 | 1 | 7 | 33.5 |
| full | 3 | extracted (turn_cap) | 555 | 90 | 10K | 1.71M | 28K | 44K | 98.4% | $0.38 | 40 |  |  |

The comparison replicate is r2 of each arm; `full` r1 was interrupted and resumed (24,686 s wall), `full` r3 aborted after re-asking one question 40 times (`turn_cap`). The repo's own report calls every pair involving `full` inconclusive. Rubric = judge score out of 40; "issues found" = planted-issue recall out of 7 per run.

| r2 comparison | superpowers | lite | full |
|---|---|---|---|
| Plan cost | $0.35 | $1.74 (5.0×) | $4.49 (13×) |
| Wall time | 147 s | 642 s | 1,474 s |
| Output tokens | 14K | 70K (5×) | 200K (14×) |
| Cache read | 0.41M | 3.37M | 9.79M |
| Peak prompt | 59K | 163K | 259K |
| Spec + plan size | 2 files, 3,261 words | 9 files, 9,697 words | 9 files, 16,346 words |
| Rubric | 28.5 | 32.5 | 33.5 |
| Cost per extra rubric point over superpowers | n/a | ≈ $0.35 | ≈ $0.83 |

Your 3 Nov question in the build session, *"what is the reason lite is up to 5* more expensive? whats the token use breakdown?"*, was answered in-session from the same data: lite makes about 4× the steps, writes about 6× the output, and re-reads a larger context each step; roughly **40% of lite's cost is output, 45% cache writes, 15% cache reads**; its reviewer subagent was 15–18% of a run ($0.22–0.30); by phase lite spent $0.74–1.48 on the spec, $0.22–0.30 on review and $0.36–0.50 on the plan.

### 8.2 Implementation stage (`impl-runs.csv`, 6 Nov; implementer arm "cheap" = Sonnet 5.5 at low effort, 2 attempts)

| Plan arm | Sample | Status | Attempts | Green at | Wall (s) | Output | Cache read | Cache write | Attempt-1 cost | Fix (attempt 2) cost | Review cost | Plan cost | Blockers | Majors | Files off plan |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| lite | 1 | complete | 2 | - | 971 | 58K | 5.72M | 151K | $1.60 | $0.16 | $0.19 | $1.74 | 1 | 7 | 7 |
| superpowers | 1 | complete | 2 | 2 | 772 | 44K | 4.44M | 137K | $1.23 | $0.21 | $0.13 | $0.35 | 1 | 6 | 6 |
| superpowers | 2 | complete | 2 | - | 957 | 43K | 5.70M | 131K | $1.30 | $0.22 | $0.13 | $0.35 | 2 | 5 | 9 |
| lite | 2 | complete | 2 | - | 1461 | 74K | 8.30M | 171K | $1.95 | $0.30 | $0.21 | $1.74 | 0 | 5 | 7 |
| full | 2 | extracted (crash) | 1 | - | 5 | 0K | 0K | 0K | $0.00 | $0.00 | $0.00 | $4.49 | 0 | 0 |  |
| full | 1 | extracted (timeout) | 1 | - | 1803 | 0K | 0K | 0K | $0.00 | $0.00 | $0.00 | $4.49 | 0 | 0 |  |

| Plan | Plan cost | Build cost per run | Green? | Notes |
|---|---|---|---|---|
| superpowers-r2 | $0.35 | $1.43 / $1.52 | s1 green at attempt 2; s2 not green (3/8 shared checks) | Cheapest and fastest |
| lite-r2 | $1.74 | $1.76 / $2.25 | not green by the grader, but an offline re-check found typecheck clean and 8/8 shared checks; only the `protected_modified` flag failed, and the task's protected-file rule forbade edits the feature itself requires | Harness/task-design artifact |
| full-r2 | $4.49 | none recorded | aborted (timeout; 5-hour account limit) | See §8.3 |

The report's own conclusions: cost is dominated by the build, not the plan (except `full`); the more expensive plan did **not** give a cheaper build; n=2 per plan, so "a pointer, not a finding"; 10 defects found in the harness by real spend, 6 fixed.

### 8.3 What the run clones actually cost (from the session logs)

The CSVs report only the runs that were extracted and counted. The clone logs show *everything that ran*:

| Stage | Arm | Run dirs | API calls | Main $ | Subagent $ | Total $ | Cache read | Cache write | Output | Cache-read share |
|---|---|---|---|---|---|---|---|---|---|---|
| impl | full | 8 | 477 | $18.64 | $0.00 | $18.64 | 74.11M | 1.33M | 592K | 98.2% |
| impl | lite | 7 | 330 | $10.55 | $0.00 | $10.55 | 36.04M | 899K | 335K | 97.6% |
| impl | superpowers | 6 | 241 | $6.82 | $0.00 | $6.82 | 23.81M | 624K | 194K | 97.4% |
| plan | full | 13 | 868 | $5.08 | $29.39 | $34.47 | 66.35M | 5.19M | 1.37M | 92.7% |
| plan | lite | 9 | 200 | $5.63 | $1.03 | $6.66 | 11.44M | 814K | 258K | 93.4% |
| plan | superpowers | 6 | 37 | $1.22 | $0.00 | $1.22 | 1.20M | 185K | 36K | 86.6% |
| spike | - | 2 | 33 | $0.70 | $0.19 | $0.89 | 964K | 191K | 11K | 83.5% |

| Comparison | Value |
|---|---|
| All experiment-run logs | **$79.26** (plan stage $42.35, impl stage $36.02, spikes $0.89) |
| Runs that formed the reported r2 comparison (3 plans + 4 builds + reviews) | ≈ $14 (≈ 18% of the spend) |
| `full` plan-stage spend, all attempts | $34.47 (vs $6.66 lite, $1.22 superpowers) |
| `full` impl-stage spend, all attempts | **$18.64 across 8 run directories with no graded result** (the report lists "none") |
| Isolation probes ("reply with exactly: ok") | 60 one-call logs, $2.13 in total (≈ $0.035 each) |

Subagents inside the plan-stage arms:

| Stage | Arm | Subagent type | Agents | Calls | Cost | Output |
|---|---|---|---|---|---|---|
| plan | full | planner | 5 | 70 | $3.38 | 167K |
| plan | full | reviewer | 19 | 133 | $4.70 | 213K |
| plan | full | spec-writer | 15 | 423 | $21.32 | 899K |
| plan | lite | reviewer | 5 | 35 | $1.03 | 42K |
| spike | - | general-purpose | 1 | 1 | $0.08 | 0K |
| spike | - | planner | 1 | 3 | $0.04 | 2K |
| spike | - | reviewer | 1 | 2 | $0.03 | 1K |
| spike | - | spec-writer | 1 | 2 | $0.03 | 1K |

**`full` is a subagent bill:** its 15 spec-writer agents cost $21.32 (62% of the arm's $34.47) and wrote 899K output tokens; reviewers and planners add $8.08. `lite`'s single reviewer is $1.03 of $6.66 (15%). `superpowers` used no subagents (single thread, peak prompt 51–59K).

The harness work also logged measurement findings relevant to your talk: assistant-event usage *undercounts* the CLI's `total_cost_usd`; `total_cost_usd` is cumulative across `--continue` and includes subagents (transcript sums matched "to the token"); duplicate message ids occur; and a resumed run's reported cost restarts at its post-resume total (so per-run ceilings under-count resumed runs). These are the same effects §0 corrects for.

### 8.4 Estimates already in the repo, against what the logs show

* `docs/skill-ecosystem-design.md` (written from the MP3 project): `PROJECT_STATE.md` ≈ 151 KB ≈ 42K tokens re-read every session; Developer Guide 295 KB ≈ 82K tokens read at every checkpoint; each reviewer loaded the full state file, "≈ 120K tokens saved per High round with a context pack". These are estimates (a single bytes-per-token ratio, flagged by the doc itself as ±20–30%).
* MP4 measurements that can be set against them: lens reviewers peak at **10–51K** tokens of context (v1 and v2), well under the ≈ 80K+ the MP3 estimates imply; the always-loaded hot state in MP4 is `STATE.md` + `guardrails.md` (the router design). The doc's own target "review round cost ≥ 50% below the MP3 estimate" cannot be scored because no MP3 per-round cost was ever recorded.

---

## 9. Codex logs (tokens only)

Codex Desktop, model `gpt-6.1-terra` (approval reviews run on `codex-auto-review`). Input tokens are cumulative across every call in a thread (each call resends context), so they are comparable to Claude's cache-read-plus-write total, not to fresh input. 98.1% of them were served from cache.

| Thread type | Threads | Input tokens | Cached | Output | Reasoning |
|---|---|---|---|---|---|
| Your root threads | 17 | 179.5M | 176.5M | 212K | 23K |
| Sub-agents | 76 | 152.1M | 149.5M | 237K | 30K |
| Guardian (auto-approval reviews) | 27 | 2.3M | 1.6M | 8K | 4K |

By root thread (one orchestration + its sub-agents + guardian reviews):

| Start (UTC) | End | Branch | First user message / purpose | Sub-agents | Guardian reviews | Total input (incl. cached) | Cached % | Output | Sub-agent input | Guardian input | Root-thread input | Root peak ctx |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 11-01T23:59 | 11-03T00:39 | w10-ui-mockups | Review PR at https://github.com/CS3227-2610-MP4-Easel/CS3227-2610-MP4/pull/5 | 0 | 0 | 13.62M | 96.5% | 23K | 0K | 0K | 13.62M | 211K |
| 11-02T13:22 | 11-02T13:23 | fold-w10-state | provide a summary of the multi-agent workflow configured in this project and h ow that sho | 0 | 0 | 127K | 66.5% | 1K | 0K | 0K | 127K | 42K |
| 11-03T00:49 | 11-03T01:42 | w1 | These were flagged as part of a review into PR#5 for branch w1. Fix the issues if they are | 0 | 0 | 4.89M | 98.2% | 14K | 0K | 0K | 4.89M | 94K |
| 11-04T10:30 | 11-04T10:37 | w1 | (see note) | 0 | 0 | 886K | 89.3% | 3K | 0K | 0K | 886K | 94K |
| 11-04T17:24 | 11-05T01:23 | w1 | review https://github.com/CS3227-2610-MP4-Easel/CS3227-2610-MP4/pull/9 | 3 | 0 | 32.91M | 98.9% | 32K | 2.89M | 0K | 30.02M | 237K |
| 11-06T06:41 | 11-06T06:42 | w4-auth | 1. review the PR at https://github.com/CS3227-2610-MP4-Easel/CS3227-2610-MP4/pull/14 2. Pr | 0 | 0 | 418K | 81.5% | 3K | 0K | 0K | 418K | 78K |
| 11-06T15:53 | 11-06T20:07 | w4-auth | review https://github.com/CS3227-2610-MP4-Easel/CS3227-2610-MP4/pull/15 | 0 | 0 | 9.84M | 97.2% | 16K | 0K | 0K | 9.84M | 142K |
| 11-06T20:30 | 11-06T20:41 | w4-auth | review https://github.com/CS3227-2610-MP4-Easel/CS3227-2610-MP4/pull/18 | 0 | 0 | 557K | 85.8% | 3K | 0K | 0K | 557K | 80K |
| 11-06T20:50 | 11-06T20:52 | w4-auth | review https://github.com/CS3227-2610-MP4-Easel/CS3227-2610-MP4/pull/15 for meargeabilty | 0 | 0 | 681K | 89.2% | 2K | 0K | 0K | 681K | 73K |
| 11-06T20:58 | 11-06T21:07 | w4-auth | Reveiw https://github.com/CS3227-2610-MP4-Easel/CS3227-2610-MP4/pull/15 | 0 | 0 | 3.88M | 97.5% | 7K | 0K | 0K | 3.88M | 121K |
| 11-06T21:24 | 11-06T21:25 | w3-guards | review https://github.com/CS3227-2610-MP4-Easel/CS3227-2610-MP4/pull/16 | 0 | 0 | 369K | 80.3% | 2K | 0K | 0K | 369K | 73K |
| 11-08T02:39 | 11-08T02:40 | w7-implement-pm-plan-flo | review https://github.com/CS3227-2610-MP4-Easel/CS3227-2610-MP4/pull/18 | 0 | 0 | 521K | 84.4% | 2K | 0K | 0K | 521K | 81K |
| 11-08T06:39 | 11-08T11:42 | w7-implement-pm-plan-flo | Review https://github.com/CS3227-2610-MP4-Easel/CS3227-2610-MP4/pull/23 | 0 | 0 | 6.35M | 96.5% | 10K | 0K | 0K | 6.35M | 147K |
| 11-08T19:07 | 11-09T04:52 | w7-implement-pm-plan-flo | (see note) | 27 | 12 | 117.96M | 98.5% | 157K | 71.58M | 861K | 45.51M | 149K |
| 11-08T19:35 | 11-08T19:37 | w7-implement-pm-plan-flo | Review https://github.com/CS3227-2610-MP4-Easel/CS3227-2610-MP4/pull/25 | 0 | 0 | 581K | 87.8% | 2K | 0K | 0K | 581K | 84K |
| 11-10T00:22 | 11-10T00:24 | w7-implement-pm-plan-flo | (see note) | 0 | 0 | 253K | 77.4% | 2K | 0K | 0K | 253K | 57K |
| 11-10T14:42 | 11-10T19:35 | w7-link-ui | You are the orchestrator for W7c on branch `w7-link-ui`. Work only in the git worktree S:\ | 46 | 15 | 139.96M | 98.4% | 179K | 77.58M | 1.41M | 60.97M | 204K |

Sub-agent activity inside the two orchestrated builds:

| Orchestration | Sub-agent activity | Agents | Total input | Avg input / agent | Output | Peak ctx |
|---|---|---|---|---|---|---|
| W7b (Codex orchestrator 8 Nov 19:07Z) | Task implementation (T-n) | 10 | 54.18M | 5.42M | 95K | 218K |
| W7b (Codex orchestrator 8 Nov 19:07Z) | Debug / diagnosis | 2 | 9.43M | 4.72M | 12K | 161K |
| W7b (Codex orchestrator 8 Nov 19:07Z) | Review of a task / diff / amendment | 15 | 7.97M | 532K | 9K | 135K |
| W7c (Codex orchestrator 10 Nov 14:42Z) | Task implementation (T-n) | 9 | 44.50M | 4.94M | 81K | 199K |
| W7c (Codex orchestrator 10 Nov 14:42Z) | Review of a task / diff / amendment | 26 | 14.05M | 540K | 11K | 217K |
| W7c (Codex orchestrator 10 Nov 14:42Z) | Spec review lenses (impl/test/attack/maint) | 4 | 7.91M | 1.98M | 8K | 171K |
| W7c (Codex orchestrator 10 Nov 14:42Z) | Security spec / analysis / fix | 3 | 7.32M | 2.44M | 14K | 193K |
| W7c (Codex orchestrator 10 Nov 14:42Z) | Amendment (impl/test/attack) | 3 | 2.34M | 779K | 2K | 121K |
| W7c (Codex orchestrator 10 Nov 14:42Z) | Debug / diagnosis | 1 | 1.47M | 1.47M | 2K | 151K |

What this shows:
* **PR review is a Codex habit**: 11 of the 17 root threads are "review PR #N" (PR #5, #9, #14, #15 ×3, #16, #18 ×2, #23, #25), from 0.4M to 33M input tokens each (the PR #9 review, 32.9M, is the biggest non-build thread).
* **The W7b and W7c builds ran as orchestrator + sub-agents, as v2 intends, and the orchestrator stayed small.** Root-thread peak context was **149K (W7b) and 204K (W7c)**, against 650K for the Claude-orchestrated W7 build; 61% (W7b) and 55% (W7c) of all input tokens were consumed inside sub-agents. Task-implementation sub-agents averaged 4.9–5.4M input tokens each (many turns in a ≤ 218K context).
* Guardian (permission auto-review) overhead is **≈ 0.7–1.0% of a build's tokens**: cheap.
* Rate-limit telemetry in the rollouts shows the W7b orchestration peaking at **68%** of the 5-hour window and the W7c orchestration reaching **100%**, so the subscription limit, not dollars, was the binding constraint on the largest build.
* No dollar conversion is possible without the model's price, and Codex has no cache-write split, so the Claude $ columns and these columns must not be added together.

---

## 10. Trends and patterns worth saying out loud

Confidence tags: **[solid]** = directly computed from many calls; **[directional]** = small n or confounded; **[unknown]** = the data cannot say.

### Good

**G1 · Small fresh contexts are cheaper per step. [solid]** Subagent median context is 37K against 217K for main sessions (6× smaller); average cost per call $0.027 vs $0.064. Implementers peaked at 18–108K and lens reviewers at 10–51K. Subagent per-call cost fell 46% from v1 to v2 ($0.041 → $0.022) and median context from 51K to 34K, consistent with "read only your task file".

**G2 · Resource-aware decisions were made with data and recorded. [solid]** Spend caps ($3 spike on login, a $10 cap on the pilot, run only one `full` to completion, stop spend at n=2 with decision C~10, the course LLM key kept out of the experiment, review scope cut mid-build). The 15:39Z instruction on 7 Nov is a clean example: a mid-run rule change visible as a step change in reviewer count and cost per task.

**G3 · Measure → redesign in days. [solid]** The pilot (3–5 Nov) priced `lite` at 5× superpowers for +4 rubric points; the v2 redesign prompt (6 Nov) cites exactly that mechanism. v2 specs then came out about 40% smaller and the spec lifecycle about 40% cheaper (§7.2). That is the spec-driven-development story with numbers.

**G4 · The context really is cached. [solid]** 96.8% of input tokens are cache reads: 11,934 fresh tokens in 5,712 calls. The 1-hour TTL on main sessions meant normal working breaks cost nothing.

**G5 · The records can be trusted. [solid]** Recomputed cost equals the CLI total to the cent in 15 sessions with no forked ancestry; the Phase-1 numbers in the repo reconcile with the logs (§5.4).

**G6 · Codex orchestration kept the orchestrator small (≤ 204K vs 650K). [directional]** Same plan structure, different tool; the root thread's context was under a third of the Claude-orchestrated build's peak. Worth testing whether this is the tool (context handling) or the habit (a fresh thread per build).

**G7 · Review and output spend are small and well aimed. [solid]** Reviewer subagents were about 5% of the W7 build and 9% of interactive spend overall; thinking tokens were 29% of output, about $21 in total.

### Bad (or worth fixing)

**B1 · Cache writes are the largest line of the bill (40%, $112), and $33 of the interactive share is idle-return rebuilds. [solid]** 36 returns after >1 h re-wrote 8.35M tokens at $4/M; an overnight return to a 600K session costs about $2.4 before any work. Remedy candidates: end a session with a hand-off note instead of resuming a giant one; keep threads under ~200K; fork only from a compacted point.

**B2 · Context bloat doubles-to-quadruples the price of a step. [solid]** 31% of main calls had ≥ 300K context and made 46% of main spend ($0.098/call vs $0.044 at 100–200K, $0.21/call at 600K+). Median main context did not fall from v1 (213K) to v2 (223K); p90 rose from 429K to 533K.

**B3 · The v2 orchestrator is still a long-lived, large-context main session. [solid]** It was 67% of the W7 build ($13.20 of $19.63) at 400–650K context. The design moved work into subagents but the orchestrator keeps carrying the whole conversation. §9 suggests a small-orchestrator pattern is feasible.

**B4 · The plan reviewer reads the whole folder. [solid]** Plan-reviewer cost went $0.28 → $0.90 → $1.42 (context 68K → 133K → 183K) as plan folders and specs grew. The router layout limits implementers, not reviewers; per-wave or per-task plan review would apply the same idea to the one agent it currently misses.

**B5 · Titles and boundaries do not match the work. [solid]** "W7 spec" is a 33-hour, 46-file, $38.72 family; "Ponytail band" is 16 files and $39.15 of experiment-framework build. Long multi-purpose threads are exactly what B1 and B2 punish, and they make later attribution impossible without the dedupe in §0.

**B6 · Experiment spend that did not produce data. [solid]** $79.26 total vs about $14 for the reported r2 comparison. `full` implementation attempts cost $18.64 across 8 clone directories with no graded result; `full` plan attempts cost $34.47 against a $4.49 comparison run; harness defects 1–4 and the 5-hour account limit (hit twice) caused most of the waste. The report records this qualitatively; the logs price it.

**B7 · No model routing was ever exercised. [solid]** `workflow/models.json` maps `strong`, `mid` and `cheap` to the same model; the "cheap implementer" arm is the same model at low effort. Every interactive subagent ran `claude-sonnet-5-5`. The design's model-routing hypothesis (`docs/skill-ecosystem-design.md` §9) is untested, so there is no saving to claim there.

**B8 · Process-about-process dominates. [solid]** 65% of Claude spend is skills, experiment harness and experiment runs; 28% is product code. Defensible for this course (the workflow *is* the deliverable) but worth framing before an audience that assumes the tokens went to features.

**B9 · Forks and resumes hide their own cost. [solid]** 520 message ids are duplicated across logs; the naive sum overstates spend by 45%. A fork's real cost is its first-call cache rewrite, which the logs do not label.

### Unknown (the data cannot say, so do not claim)

* **Whether v2 is cheaper overall than v1.** Spec lifecycle: probably yes (about −40%, n=2 vs 3). Plan lifecycle: no (plans are bigger, plan reviewers dearer). Build: not demonstrated (§7.3). Total spec→build per feature: untested.
* **Whether the bigger plan or spec produced better code.** The experiment's advisory review counts do not separate plans, rubric gains are one replicate each, and v2 has no quality measurement at all.
* **What the skills themselves cost in tokens.** Only file sizes (§7.4); no per-skill attribution exists.
* **Teammates' token use** under either skill version.

---

## 11. Gaps to close before the talk (cheap and worth it)

1. **A real v1-vs-v2 arm.** The harness already runs arbitrary arms on `pilot-pinned-note`: add `lite-v2` (probably about $2–4 per run at the numbers above), run n=3, and compare to the existing `lite` ($1.44–1.74) and `superpowers` ($0.28–0.35) rows. That converts proxy #1 into a direct comparison. Add the lean-plan arm the report already suggests.
2. **Log per-file reads** (the harness report asks for it): turns "the router saves reading" from an inference into a measurement.
3. **Label cold-cache rebuilds** in your own notes or in `ws`: a one-line "resumed after N h, re-wrote X tokens" would make B1 visible live.
4. **Tag sessions by workstream in the title** (or use one session per phase) so attribution survives without dedupe.
5. **One cheaper-model test** on reviewers or implementers (`models.json` already supports tiers) to turn B7 from "untested" into a number.

---

## Appendix A · Daily spend (UTC)

| Date (UTC) | Interactive sessions | Experiment runs | Total | API calls | Output tokens |
|---|---|---|---|---|---|
| 2026-10-28 | $9.99 | $0.00 | $9.99 | 145 | 362K |
| 2026-10-29 | $5.24 | $0.00 | $5.24 | 119 | 154K |
| 2026-10-30 | $9.86 | $0.00 | $9.86 | 165 | 192K |
| 2026-10-31 | $1.73 | $0.00 | $1.73 | 37 | 21K |
| 2026-11-01 | $22.28 | $0.00 | $22.28 | 426 | 583K |
| 2026-11-02 | $1.23 | $0.00 | $1.23 | 35 | 18K |
| 2026-11-03 | $32.34 | $17.02 | $49.36 | 936 | 1.33M |
| 2026-11-04 | $15.77 | $26.17 | $41.94 | 923 | 1.42M |
| 2026-11-05 | $25.30 | $7.91 | $33.21 | 596 | 707K |
| 2026-11-06 | $11.26 | $28.17 | $39.43 | 1048 | 1.09M |
| 2026-11-07 | $34.55 | $0.00 | $34.55 | 740 | 688K |
| 2026-11-08 | $16.74 | $0.00 | $16.74 | 323 | 323K |
| 2026-11-09 | $1.48 | $0.00 | $1.48 | 21 | 23K |
| 2026-11-10 | $11.95 | $0.00 | $11.95 | 198 | 315K |

## Appendix B · Reproducing these numbers

Scripts (Python 3, standard library only) live in `docs/telemetry/token-analysis/`. Run in order: `extract2.py` (Claude logs → `data2.json`), `gen1.py` (dedupe, ownership, totals), `gen3.py` (families), `gen4.py` (subagent roles, phases), `gen5.py` (experiment clones), `cx_extract.py` + `gen6.py` + `gen8.py` (Codex), `gen7.py` (cache, context, CSV tables). They contain hard-coded paths for this machine; edit the `SP`, `R` and `PR` constants at the top of each.

Key definitions: *unique call* = one `message.id`; *owner* = the earliest-starting file containing it; *family* = connected component of files sharing any message id, with each subagent attached to its parent session; *rebuild* = a main-session call after a >3,600 s gap where cache-write tokens are ≥ 50% of the call's context; *context* = fresh input + cache read + cache write for one call.
