# Nathan's Reflection:

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

---

# Trevor's Reflection

## 1. Multi-Agent Software Engineering

### How should multiple agents be coordinated and verified?

The most effective pattern was an orchestrator with narrow, role-specific agents. The orchestrator reads the project state and plan, dispatches one implementer per task, and passes a small task brief plus dependency handovers. Implementers do not read the whole repository or edit state files; they return a structured handover. Reviewers then inspect the result through a specific lens. This is captured in `workflow/agents/`, `writing-plans-lite-v2`, and `executing-plans-lite-v2`.

The pattern is verifiable because each boundary has an artifact: task files define the contract, worktrees isolate independent tasks, handover JSON records results and checks, branch state records progress, and approval gates record human decisions. The W9 close-out records concrete failures—StrictMode double execution, requests after unmount, a stuck loading state and stale banners—and tests added for them. That is stronger evidence than merely counting successful agent calls.

### Were the benefits worth the coordination cost, and when should it be used?

Multi-agent coordination was worthwhile for Big, cross-cutting work such as W9, where backend contracts, context assembly, security rules and UI behavior could drift. It was less justified for a small documentation change. The repository's size-based ceremony is useful: Small changes need only a recorded change, Medium changes need one short spec and one reviewer, while Big changes receive task decomposition, independent tests and multiple review lenses.

The pilot shows the trade-off. Plan-writing cost about $0.35 for superpowers, $1.74 for lite and $4.49 for full, with rubric scores of 28.5, 32.5 and 33.5 out of 40. The sample was too small to declare a winner, and the full arm hit a timeout and the account's five-hour limit. I would use multiple agents when parallel work or independent verification reduces meaningful correctness risk, not merely because the workflow makes it easy.

## 2. Context Engineering

### How should prompts, skills and handoff notes be designed?

The system prompt should be a router, while detailed procedures belong in skills and role files. Each agent should receive only the task file, shared contract, relevant tests or stubs, and a short dependency handover. A useful handoff records changed files, checks run, assumptions, unresolved risks and the exact next action; it should not paste the whole conversation or repository history.

This structure is implemented in the project. `AGENTS.md` is a short router; hot state is in `STATE.md` and `guardrails.md`; decisions, deviations and architecture areas are cold files loaded only when relevant. `ws pack <role>` produces a role-specific reading list, plan tasks are self-contained, and reviewers receive a 3–5 KB review bundle instead of opening all state files.

### When does more context hurt, and what evidence shows it?

More context hurts when it adds history or generic instructions that the agent cannot use for the current decision. Telemetry shows two signals: median first-call context increased from 22.7K tokens in MP3 to 41.7K in MP4 because skills, tools and agent definitions added fixed overhead, and one long session grew to about 650K tokens.

The review-bundle redesign was the clearest win: median reviewer peak context fell from 76K to 28K tokens and median calls per reviewer fell from 30 to 4. However, total reviewer input stayed nearly flat—15.9M tokens in MP3 versus 16.4M in MP4—because the team ran many more reviewers. Context engineering therefore needs a total-use metric, not only a per-call metric.

## 3. Resource-Aware Use

### How should the model and workflow be configured under resource limits?

Model choice should follow task risk and the cost of being wrong. A stronger model or more reasoning is justified for architecture and security-sensitive design; a cheaper or faster tier suits mechanical implementation and focused review. `workflow/models.json` and the role files define this separation, but the recorded configuration maps all Claude tiers to `claude-sonnet-5-5` and all Codex tiers to `gpt-6.1-sol`. The intended routing exists, but different-model routing was not yet validated.

The product applies the same principle through explicit section budgets, priority-based trimming, input hashes and summary caches. It computes facts before asking a model to explain them, and the gateway records prompt/completion tokens, estimated tokens, truncation, retries, latency and cost. These controls make resource use observable and bound failure costs.

### What did caching and monitoring reveal?

The token log recorded 976.9M input-side Claude tokens, of which 945.9M were cache reads: a 96.8% cache-read share. Cache writes still represented 40% of list-price spend ($112.13), while cache reads were 34% ($94.59). There were 36 cold-cache rebuilds after more than an hour idle, rewriting 8.35M tokens and costing about $33.41. The practical lesson is to keep related work in a stable session, avoid needless forks, and keep repeated context identical enough to hit the cache.

Reasoning output was 2.12M tokens, or 29% of Claude output, in the measured logs. The workflow did not persist hidden chain-of-thought; it persisted decisions, handovers, test results and next actions instead. That is the useful form of persisted reasoning: auditable conclusions another agent can act on without storing private internal deliberation. Process/tooling consumed 65% of spend and product code 28%, so the largest savings came from reducing repeated workflow analysis and unnecessary context.

## Final Takeaway

My biggest takeaway is that working with AI agents is still mostly about working well as a team. Multiple agents helped when everyone had a clear job, enough context to do it, and a useful handoff for the next person. Without those things, parallel work just created repeated analysis and extra review. I also learned that context is not free: giving an agent every document “just in case” can make it harder to find what matters. The best approach was to provide the important contracts and decisions early, retrieve less important details only when needed, and record short notes that another agent could actually use. Finally, saving tokens is only useful if we measure what happens to the saved capacity. My practical rule going forward is to use the simplest model and workflow that is safe for the task, add another agent only when it brings a genuinely different check, and use cost, token and quality data to see whether the extra effort was worthwhile.

---

# Congchen's Reflections

My scope this time was the PM side. That meant the UI design (W10), the PM plan flow where the LLM turns an idea into an outline, epics and tasks (W7, W7b, W7c), and then wiring the UI to it live (W7-UI). I also spent a lot of effort on the skills and the experiment harness behind all of that. This time I read the session logs and put real numbers on what it all cost. The headline surprised me: **65% of my Claude spend went into process and measurement, and only 28% into product code.** The rest of this is me asking whether that was a good deal.

### How the PM work actually ran

It went in three rounds, and each one used the agents differently.

**W10, the UI design.** This was nearly all me and one long thread. I designed 20 screens on a design canvas, then converted 73 canvas pages into a routed React prototype with a linkcheck that passes for all three roles. I kept the review light on purpose: only the Implementer lens looked at the spec (C6), because a UI spec is lower risk than a security spec. The prototype session was my most expensive uncontrolled one. It ran 371 calls and $18.59 at a peak of 562K context, with 5 compactions.

**W7, the PM plan flow.** This one got the full pipeline. The spec was rated High tier, with 56 edge cases and 12 threats, and was reviewed by Implementer, Tester, Maintainer and Attacker lenses. The plan had 11 tasks in 6 waves. An orchestrator dispatched implementers, and each task got a reviewer. W7b (editing and regeneration) and W7c (story points 1–20 and one bulk-expand call for the whole plan) followed the same shape, but lighter. W7b and W7c were also built by a Codex orchestrator, not Claude.

**W7-UI, live wiring.** This went back to a single thread with me giving lots of feedback. I reworked the plan page, the backlog, the project switcher, and the styled dropdowns. I audited every screen against a local database.

### Multi-agent SE

**Did the coordination pattern work?** Mostly yes, and the clearest proof was the bugs the reviewers caught. Full reviews found a Unicode separator injection in T4/T5, a race condition in the T7 PM flows, a missing bulk-failure UI state, and a stale-claim problem in W7c (D~6). Running against a real Postgres found a session-rule regression (C~3) that skipped tests had been hiding. None of that came from "the agents agreeing with each other". It came from each lens looking at the work differently.

**How did I check the handoffs?** I don't trust a summary. I look at what each stage leaves behind: the plan's Status column, handover files and the Changes ledger with test counts. For example: "781 passed, 0 failed, 0 skipped". The "0 skipped" part matters, because the skipped tests are exactly what hid the C~3 bug.

**Who was overloaded, idle or blocked?** The Claude orchestrator was overloaded. On the W7 build it made 126 calls at 400–650K context and cost $13.20 of the $19.63 build (67%). The 170 implementer calls cost $3.22, and all per-task reviewers together cost $1.00. The Codex orchestrators for W7b and W7c stayed at 149K and 204K peak. The blocked party was usually a limit: the W7c orchestration reached 100% of its 5-hour window. The idle party was usually me, waiting at an approval gate. One 9-hour wait cost a $2.35 cache rebuild. I never measured agent idleness directly, so that's as far as I can go.

**Waste and retries.** A few honest examples. T10 needed a retry and a continue, about $1.20. The W7b final suite ended at 721/728 with five failures I couldn't explain (D~10). A transaction-marker test is still flaky on local Postgres 16 with an unproven cause. And the experiment runs cost $79.26 in total, but the comparison I reported was about $14 of that. One full replicate re-asked the same question 40 times before it hit turn_cap.

**Conflicts.** The agents rarely disagreed with each other. The real conflicts were between a request and a recorded decision. Story points up to 20 collided with AD-12, so the agent stopped and held it for me (it became C~3). The Tier 2 removal reversed C19, C27 and C83. The collision rule forced both to be a conscious yes from me, with a recorded reason.

**A coordination failure.** My branch states got messy because Codex created its own codex/w7* integration branches with their own records. In the end I had to consolidate w7-link-ui.md, a CI-investigation record and three Codex integration files into one. It's the multi-tool version of two people editing the same doc. A merge also silently left live-backlog.tsx unreachable, because W14's backlog-list.tsx took over. I only caught it by comparing the merged tree against the spec.

**Was it worth it?**

| Measure | Result |
|---|---|
| W7 spec + plan lifecycle (v2) | $3.89 + $2.65 |
| W7 build | $19.63 for 11 tasks, about $2.19 per task |
| Plan reviewer cost, W7 → W7b → W7c | $0.28 → $0.90 → $1.42 (context 68K → 133K → 183K) |
| Subagents' share of interactive spend | 9% |
| lite vs superpowers plan cost | 5× for +4 rubric points out of 40 |

So it pays off for the high-risk backend work, where one injection or race bug would be expensive. It paid off less for the UI work, which is why W10 got a single lens. I also noticed the plan reviewer is the one agent my "read only your task file" design doesn't help, because it reads the whole folder.

### Context engineering and resource-aware use

**Upfront vs on demand.** A small hot set loads every session: AGENTS.md as a router, STATE.md and guardrails.md. Everything else is pulled by ID. Implementers get their task file plus a pasted Shared context block. The experiment taught me something there. In my lite skills, the builder skipped about 41 KB of spec files, but only because its prompt said the plan was the spec. Splitting files only saves tokens if nobody opens them. That's why v2 uses one spec file and splits the plan instead. The three v2 skill files also came out about 17% lighter to load.

**What goes in a handoff.** The session table with a Next action per row worked better than I expected. A Claude session (s3) picked up cleanly after a Codex session (s2) on the same branch, because "Next action" said exactly what to verify. The decision rows with who asked and why also stopped re-proposals. But it fails when I don't prune. w7c-pm-ui.md now has a "Historical checklist (superseded)" and rows from 8 Nov still marked Paused. It literally warns that they need reconciling before a fold. STATE.md is about 30 KB, and some Upcoming cells run to a whole paragraph.

**When more context hurt.** For the UI work, I could see it in the cost per call, not in confusion. A step above 600K context cost about $0.21, against $0.044 at 100–200K, for the same ~500 output tokens. 31% of main calls sat above 300K and used 46% of main spend. The "W7 spec" thread ran 33 hours across 46 log files and cost $38.72. UI iteration is the worst case for this: lots of small feedback turns, all riding on a huge conversation. A related defect also slipped through: the canvas screens were fixed-size, with .app { min-height: 1000px }, and I only noticed on an ultrawide monitor.

**Cache.** Fresh input was only 11,934 tokens out of 976.9M, so 96.8% of input was cache reads. But cache writes are 40% of the bill ($112), reads only 34%. Idle returns are the avoidable part. 36 returns after more than an hour re-wrote 8.35M tokens for $33.41 (18% of interactive main spend). A 600K session left overnight costs about $2.4 before it does anything. My fixes are handoff notes instead of resuming giant sessions, threads under about 200K, and fresh orchestrator threads for builds. That last one shrank the peak from 650K to 149K and 204K, though I haven't priced it in dollars.

**Model choice.** I have to be honest: I never tested model routing. All three tiers in models.json point at the same model, and my "cheap implementer" was the same model at low effort. The resource-aware choices I did make were about the product. For W7c's bulk call I measured the live model (llama3.1:8b, 10 epics) at 12.3–26.9 s and 977–2,086 output tokens, then set the limits to 2× that: 54 s and 4,200 tokens.

**Reasoning tokens.** Thinking was 2.12M of 7.22M Claude output tokens (29%), about $21. On Codex it was roughly 57K of 457K output (about 12%). I didn't test persisted reasoning. What I do persist is the conclusion, as decision rows and Deviations, not the reasoning itself.

**Monitoring and cutting usage.** I wrote analysis scripts in docs/telemetry/token-analysis/. They dedupe by message id (the raw log sum of $403.71 is really $278.98) and match the CLI's cost tally to the cent on sessions with no forks. The harness has cost ceilings of $25 per run and $100 per batch. At 15:39Z on the W7 build I also told the orchestrator to review only non-trivial work, and the logs show it. But reviewers were only 5% of that build, so I cut the smallest line and left the orchestrator alone.

**Where the tokens went.** The order was the experiment framework and its runs, long uncontrolled sessions like the UI prototype, and the orchestrator's carried context. The one real structural saving was spec cost, which fell about 40% with v2.

### Closing

The PM work taught me that the pipeline earns its cost where mistakes are expensive and bounded tasks can be handed off, like W7's backend. It was less clearly worth it for UI iteration, which is better as a short, focused session than a giant thread. Next I'd want a real v1-vs-v2 arm in the harness and a cheaper model on the reviewers, so those two "unknown" lines become numbers. I'd also verify the live PM flow in a browser before calling it done. The authenticated flow, the D~8 live outline and the backlog conflict recovery are all still unverified.
