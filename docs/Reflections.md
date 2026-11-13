Nathans Reflection:

To gather evidence, I used:

1. **My Claude Code session logs.** I parsed 16 MP3 sessions and 13 MP4 sessions, plus every subagent they spawned: 219 transcripts in total, from 18 Oct to 9 Nov 2026. For each API call I counted the input tokens (including cache reads and writes) once. I tagged each transcript by agent type (main session, reviewer, implementer and so on) and recorded how many bytes each Read of a workflow-state file returned. Script: `tokens.py`. Output: `tokens.csv`, one row per transcript.
2. **The team's planning-workflow pilot** done by Congchen, `docs/telemetry/experiments/pilot-overall-report.md`. Three plan-writing arms (`superpowers`, `lite`, `full`) on one task, then a costed implementation stage. Every figure in it comes from a recorded run.

---

## 1. Multi-Agent Software Engineering

### What the setup was

MP3 had one main agent that ran almost everything, plus three generic `lite-reviewer` subagents that each loaded the whole project state. MP4 split the work into **ten role agents** (`architect`, `slicer`, `spec-writer`, `planner`, `interface-drafter`, `test-author`, `implementer`, `reviewer`, `doc-writer`, `state-clerk`). Each role has a written contract in `.claude/agents/*.md`, generated from `workflow/agents/`: what it reads, what it writes, what it must never touch, and what it returns. 

`executing-plans-lite-v2` turns this into an orchestrator pattern. The main session reads `STATE.md`, `guardrails.md` and the branch state. It dispatches one implementer per task with a task file as its brief, then reviewers by lens (Implementer, Tester, Attacker, Maintainer, User). Each subagent hands back a structured JSON handover, not a chat transcript.

### What the experiments say about multi-agent review

- **More agents ran, not fewer.** My MP4 sessions ran **98 reviewer subagents against 9 in MP3**. Splitting review into cheap single-lens runs made reviewing so easy that we did far more of it (cost is in section 3).
- **Same-model review does not separate plan quality.** In the pilot, one same-model advisory reviewer found 1–2 blockers and 5–7 majors in *every* completed build, with "no separation between plans". A reviewer that flags roughly the same amount on everything is a weak signal for choosing between approaches, even if it is useful for finding bugs in one.
- **Harness design dominates small experiments.** Both `lite` builds in the pilot were marked "not green" only because the task's `protected_globs` banned test edits the feature itself required (three new endpoints change the count assertions in `authorization-matrix`). After the fix they passed every automated check. When agents are graded by another program, a badly drawn rule can produce a fake result.

### Reflection

The biggest change from MP3 was moving from "one agent that knows everything" to **agents that know only their brief**. That only works if the brief and the handover are good enough to stand in for shared memory, so much of the effort went into task files and handover schemas, not prompts. Humans also stayed in the loop on purpose: `AGENTS.md` §8 has six approval gates where the agent asks one question and records the owner's yes. In W9 my approvals are recorded in commits, for example `f7653c1` (Gate 1) and `74acbf6 docs: record Gate 3 approval for the S20/S18 wiring (W9)`. teleifo's agent-policy hook adds a zero-token guardrail on top: every tool call is checked against `workflow/agent-permissions.json` (default deny, protected paths, repository and web text treated as data rather than instructions).

What I would change: reviewer count needs a **budget per change**, not just a lens list. Three rounds on T5 were justified. Ninety-eight reviewers across my sessions were never a decision anyone made.

---

## 2. Context Engineering

### The MP3 problem

My MP3 post-mortem (`CS3227-2610-MP3/context-engineering+resource-aware.md`) found that `AGENTS.md` told every agent to read the 151 KB `PROJECT_STATE.md` in full before doing anything. That cost roughly 48K tokens before a one-line question. For the largest workstream, spec plus plan plus state used about half the context window at session start. The developer guide was a single 295 KB file. Those were file-size estimates, so for MP4 I measured instead.

### Change 1: hot/cold state split, with a router

MP4's skills (implemented by Xiao-Congchen) split state into a **hot** part that is always loaded (`STATE.md` plus `guardrails.md`) and **cold** files read by ID only when a task touches them (`decisions/C<n>.md`, `architecture/<area>.md`, `deviations/D<n>.md`). `AGENTS.md` shrank from 20.0 KB to a 4.9 KB "Router only" file. `ws pack <role>` lists exactly what each role should read.

I found 90% less state read per session. Two caveats I found only because I measured:

1. Part of the drop is sessions skipping `STATE.md` entirely, not reading a smaller file. Some of that is right (a subagent should not read it), and some may mean the agent is missing context it should have had.
2. Fixed overhead grew quietly. Median context at the first API call of a session rose from 22.7K tokens (MP3) to 41.7K (MP4), because of more skills, tools and agent definitions loaded up front. Cutting state saved bytes that the toolchain then partly spent.

The hot file is also not staying small. `STATE.md` was 21.7 KB at my final presentation (10 Nov) and is 30.7 KB now (13 Nov), against an 8 KB target that `ws budget` flags. A hot/cold split only stays useful if someone keeps moving settled content to cold files.

### Change 2: Subagent context (review bundles)

Reviewers no longer open state files. They get a pre-built review bundle of **4.8–13.7 KB** (`.ws/review-bundle*.md`) plus the diff. Median reviewer **peak context fell from 76K to 28K tokens**, and calls per reviewer fell from 30 to 4. That is the clearest context-engineering win in the data. A reviewer with a 28K-token context is working on the diff, not wading through project history.
### Reflection

In MP3 I treated context as free and wrote "read everything first, to be safe" into the skills. MP4 treats it as a budget: a router instead of a manual, hot and cold state, and role-scoped bundles. The measurements confirm the per-unit effect. They also showed two things I would not have predicted: savings leak into fixed overhead, and hot files creep back up in size. Context engineering is not something you set up once. It needs a budget check (`ws budget`) that someone actually acts on.

---

## 3. Resource-aware Use

### Reviewer cost: a per-unit win, the same total

| Reviewer metric (session logs) | MP3 (n=9) | MP4 (n=98) |
|---|---|---|
| Input tokens per reviewer, median | 1.72M | 79K |
| Calls per reviewer, median | 30 | 4 |
| Peak context, median | 76K | 28K |
| **Total reviewer input** | **15.9M** | **16.4M** |

Each review became **about 95% cheaper (roughly 20×)**, and we ran **about 11× more** of them. Total reviewer spend stayed about the same. This is the classic rebound effect: an efficiency gain was spent on more consumption rather than saved. It may have been the right trade, since more lenses on more tasks caught real bugs like T5's. But nobody chose it. Resource-aware use means deciding where a saving goes, not just making it.

### Ceremony must earn its cost: the planning pilot

From Congchen's pilot:

| Arm         | Plan cost (USD) | Bytes  | Rubric (/40) |
| ----------- | --------------- | ------ | ------------ |
| superpowers | 0.35            | 22 KB  | 28.5         |
| lite        | 1.74            | 62 KB  | 32.5         |
| full        | 4.49            | 101 KB | 33.5         |

The heavier plans cost **5× (lite) and 13× (full)** more for **+4 and +5 rubric points**. The extra cost sat in plan writing, not building: lite builds cost 1.76 and 2.25 USD against 1.43 and 1.52 for superpowers. The more expensive plan did not produce a cheaper build. With n=1–2, the report rightly calls this "inconclusive" and "tradeoff". Even so, it changed my default. I should start light and add ceremony only when the risk justifies it.

The pilot also hit real resource limits. One `full` build was aborted by a turn timeout and the other by the account's 5-hour usage limit. The harness had per-run and per-batch cost ceilings (10 and 70 USD) so that experiments could not drain the shared budget.

### Size-based ceremony: the Medium tier

My second post-mortem suggestion was a Medium tier, because in MP3 a 400-line correction still got a 19 KB spec, a plan and a 57 KB branch state. MP4's `AGENTS.md` §3 sizes work as Big, Medium or Small using one triage question: *does it change a contract, a schema, or permissions?*

- **At my final presentation (10 Nov), no change had used it.** All nine MP4 workstreams ran as Big. Documentation bytes per code line still fell, from 60–230:1 in MP3 to 24–79:1 (48:1 overall), but that came from leaner Big specs.
- **Since then I used it myself.** `workflow/specs/2026-11-12-w9-screen-wiring-design.md` (approved 12 Nov) is MP4's first Medium spec: frontend only, calling existing endpoints 9, 49–52 and 55, with no contract, schema or permission change. One file served as both spec and plan, with one reviewer.
- **The first real use broke the limit.** The template caps Medium specs at about 4 KB. Wiring two screens with many states and exact error copy needed 8.8 KB (17 edge cases, 5 tasks). Cutting it to 4 KB would have dropped exact messages the implementer would otherwise have to guess. I logged this as skill feedback (2026-11-12) and suggested about 10 KB for UI specs, or counting only Goals, Contract and Edge cases toward the cap. The file has since grown to 12.4 KB through review. So the tier works, but a size cap set without real data was too tight for UI work.

### Reflection

In MP3 I deliberately used a weaker, smaller-context model to push the limits, and it showed that the bottleneck was my workflow, not the model. In MP4 the lessons are:

1. **Savings get spent.** Measure totals, not just per-unit cost, and decide where the saving goes.
2. **Fixed overhead grows quietly.** Session-start context nearly doubled while I was cutting state files.
3. **Built isn't adopted, and adoption tests the design.** The Medium tier sat unused until a real change used it, and then its cap turned out to be wrong.
4. **Measure, then believe.** File-size estimates hid both the 95% saving and where it went.

This reflection is largely based on the final presentation i gave for MP4.

