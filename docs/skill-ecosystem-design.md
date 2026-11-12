# Skill Ecosystem Redesign: Context-Lean, Resource-Aware Workflow

- **Status:** Design agreed in principle; open questions Q1-Q11 resolved (see §12); revised after external review 2026-10-29; nothing implemented
- **Date:** 2026-10-29
- **Inputs:** `context-engineering+resource-aware.md` (MP3 findings, P1-P9); user-level skills in `~/.claude/skills`; MP3 `AGENTS.md` and `.claude/agents/lite-reviewer.md`; MP4 `docs/architecture/`
- **Scope:** the skills, agents, scripts and file layout that every project inherits. Not the MP4 application itself.

---

## 1. Goal and principles

Make agents read the least possible context and know only what their role needs, without losing the continuity and decision discipline the current system provides.

| # | Principle | Consequence |
|---|---|---|
| 1 | **Read by role and task, never "in full".** | The "read `PROJECT_STATE.md` in full" mandate is the root cause of P1, P2, P9. It is replaced by a read-set per role. |
| 2 | **Hot state is small; history is addressable.** | Current position and final decisions live in a few KB. Rationale, deviations and ledgers live in per-item files read by ID. |
| 3 | **One source of truth per rule.** | Procedure lives in a skill. `AGENTS.md` only routes. Skills are edited **only at the user level**; project copies are read-only products of a sync (§8), never edited in place. |
| 4 | **Deterministic work goes to scripts.** | Status edits, Changes lines, ID renumbering, section extraction and size checks cost no tokens and cannot drift. |
| 5 | **Ceremony scales with size.** | Small, Medium, Big tiers. Record scales less than ceremony but is mostly derived, not hand-written. |
| 6 | **Each role has a contract.** | Declared reads, writes, forbidden paths, return format and model. Enforced by lint (and a hook where possible). |
| 7 | **Keep a small always-on guardrail.** | Lean context must not cause the mistakes the state system exists to prevent (re-implementing a Known Gap, reversing a decision unknowingly). |
| 8 | **Measure before and after.** | Size budgets in lint, tokens per stage from session usage, model routing validated by experiment (section 9). |

---

## 2. Findings: valid issues

Severity is the owner's cost: tokens and context window first, then quality risk.

**Legend: IDs used in this document.** Several ID families look alike, so each table that uses them starts with this key.

| Notation | Means | Where defined |
|---|---|---|
| `V1`..`V8` | Valid finding from the MP3 analysis | §2 (this doc) |
| `W1`..`W6` | Weak or partly wrong finding | §2 (this doc) |
| `M1`..`M13` | **M**issed by the MP3 analysis: a gap this doc identified. (Renamed from `G`, which clashed with architecture `G-nn`.) | §2 (this doc) |
| `Q1`..`Q11` | Open question for the owner | §12 (this doc) |
| `AD-nn` | **A**rchitecture **D**ecision: a choice about the intended design (Target architecture) | `docs/architecture/decision-log.md` |
| `G-nn` | Architecture gap (a decision still needed) | `docs/architecture/` |
| `C<nn>` / `C~n` | Project decision (permanent / provisional on a branch) | `PROJECT_STATE` § Decisions |
| `D<n>` / `D~n` | **D**eviation: reality diverged from a spec or plan | `PROJECT_STATE` § Deviations |
| `L<nn>` / `L~n` | Lesson (5.7) | `lessons/` |
| `F`, `N`, `E`, `T` | Spec functional requirement, non-functional requirement, edge case, task | per spec |

| ID | Issue (source) | Verdict | Evidence | Fix (section) |
|---|---|---|---|---|
| V1 | `PROJECT_STATE.md` is ~151 KB (~42K tokens) and must be read in full every session (P1) | **Valid, critical** | Mandate repeated in `AGENTS.md` §1, `maintaining-project-state`, `writing-specs-lite` step 1, `executing-plans-lite` preconditions, `lite-reviewer` | 4, 5 |
| V2 | `AGENTS.md` (~20 KB) duplicates skill content and is loaded every session (P2) | **Valid** | Triggers, gate lifecycle, status vocabulary, acid test, collision rule, sizing table all appear in both | 4.1, 8 |
| V3 | One ceremony for every Big change (P3) | **Valid** | 6 small display fixes produced 19 KB spec, 16 KB plan, 3 reviewer runs | 6 |
| V4 | Developer Guide is one 295 KB file; every checkpoint reads it (P5) | **Valid** | ~82K tokens | 4.4 |
| V5 | Each reviewer loads the full state file; same file read 2-3x per round (P9) | **Valid** | ~120K tokens saved per High round with a context pack | 5.3 |
| V6 | Branch-state template forces "No change." sections; branch states reach 57 KB (P7) | **Valid** | Min ~4-5 KB; W-HOST 57 KB | 4.3 |
| V7 | Reasoning is lost across compaction; sessions re-derive from spec and code (P8). Verified against the skills: operator decisions (trigger 4) and plan divergences (Deviations) are recorded, but **the agent's own mid-task implementation choices, small answers to the agent's questions, and the agent's mistakes with the operator's corrections have no home** | **Valid problem, wrong fix** | See W3; `grep` of `maintaining-project-state` finds no lessons/pitfalls category, only "traps" inside Deviations | 5.4, 5.7 |
| V8 | No model routing; reviewer agent has no `model` (P4) | **Valid problem, unproven fix** | See W2, section 9 | 9 |

### Weak or partly wrong findings (kept, corrected)

| ID | Finding | What is wrong | Corrected treatment |
|---|---|---|---|
| W1 | **P6 cache-aware ordering.** Volatile state loaded early "busts the cache for everything after it". | Inside a session, an edit does not invalidate earlier cached context; new reads are appended. Cache cost comes from re-reading big files after compaction and from large reads staying in the window every turn. The stable prefix (system prompt, `CLAUDE.md`, `AGENTS.md`) is cached across sessions, so keeping it small and unchanging still helps. | Keep "stable content first" as a minor guideline. Splitting the sessions table out of the branch state is **optional** (§4.3: it stays in How to Resume to keep the project-state mirror) and worth doing only if merge conflicts on it are measured; it is not a caching fix. The real lever is reading less (V1, V5). |
| W2 | **P4 model cost table and the Haiku-for-state-updates claim.** | Prices listed are for an older model family (Haiku 4.5, Sonnet 4.6, Opus 4.6); current family is Claude 5. The 18x figure is therefore unreliable. Also, writing state is judgement-heavy (it must pass the acid test), so assuming Haiku suffices is untested. | Treat the direction as plausible, the numbers as placeholders. Re-pull prices at experiment time. Remove most state-writing from LLMs entirely via scripts (4.3, 5.2), then route only the residue. Validate by experiment (section 9). |
| W3 | **P8 option 2:** persist the model's chain-of-thought. **P8 option 1:** `reasoning.md` per branch. | Chain-of-thought is not a persistable, replayable artifact; this option should be dropped. `reasoning.md` risks becoming a second diary, the exact failure the Progress-cell rule exists to prevent. | Bounded "Notes for next task" block inside the plan task, capped, deleted at fold (5.4). |
| W4 | **P3 bytes-of-doc per code line** compared with "industry norms". | Industry numbers are unsourced. Bytes written is not the cost; tokens **loaded and unused** is. The metric also blends spec, plan and state. | Replace with: tokens loaded per stage, and share of loaded tokens actually referenced (section 10). Keep the W-HOST-EXPERIENCE-CORRECTIONS case as the qualitative example. |
| W5 | **P1 token estimates** use a single bytes-per-token ratio. | Markdown tables and IDs tokenise worse than prose; estimates may be off by 20-30%. | Directional only. Measure real token counts before and after (section 10). |
| W6 | **P2 drift example** (trigger 1 wording differs). | Real but minor; the larger harm is the always-loaded 20 KB, not the wording drift. | Fixed as a side effect of V2. |

### Gaps the findings doc did not identify

| ID | Gap | Fix |
|---|---|---|
| M1 | Mechanical state work done by the LLM (status cells, Changes lines, ID minting at fold, section lookup). | `ws.mjs` scripts; derive Changes lines from commit trailers (5.2) |
| M2 | Build and test output floods context. | Summary-only runners; failing-test names plus first N lines (5.5) |
| M3 | No context lifecycle: `executing-plans-lite` can run a whole plan in one session. | Fresh context per task or wave is the default (5.4) |
| M4 | Skills are monoliths. `maintaining-project-state` is 16 KB, `writing-specs-lite` 17 KB, loaded whole on invoke. | Router skill under ~3 KB plus on-demand reference files (8) |
| M5 | Project-level copies of skills exist (MP3 `.claude/skills/`) **by design, so collaborators get the same skills**. The problem is not the copies but that they are unmanaged: they can drift from the user-level source, and MP3 also carries superseded skills (`brainstorming`, `writing-plans`). | Keep vendoring, but one-directional (decided): edit only the user-level skill, then `ws skills sync` into the project; project copies are read-only, checked against a checksum lock (5.6, 8) |
| M11 | No place for **lessons**: mistakes the agent made and the operator corrected, and rules to avoid them. | `lessons/` records, role-scoped, loaded into the matching role pack (5.7) |
| M13 | Each test run pays for container start, migration and context startup; extra containers plus JVMs have caused out-of-memory crashes (`hs_err_pid*.log` in MP3 `backend/`). | Persistent shared services, template-database cloning, quiet runner that ensures them (5.8) |
| M12 | Agent definitions mix provider details (model, tools syntax) with role contracts, so skills are tied to one provider. | Provider-neutral role definitions plus generated `.claude` / `.codex` adapters (5.6) |
| M6 | No size budgets or token measurement. | Lint budgets; usage per stage (10) |
| M7 | The reviewer reads whatever it wants. | Pre-built, role-scoped context packs (5.3) |
| M8 | Architecture (design intent) and state § Architecture (what is built) are blurred, and there is no skill that turns architecture into workstreams. | Separate Target vs Now; new bridge skill (7) |
| M9 | Tests are written by the same agent that writes the implementation, so they inherit its misreadings. | Blind test authoring (6.3) |
| M10 | Lean context could cause decision collisions. | Always-on guardrails file (4.2) |

---

## 3. System overview

```
                  ┌─────────────────────────────────────────────┐
 Layer 0          │ AGENTS.md router (≤3 KB) + guardrails.md (≤2 KB) │  always loaded
                  └─────────────────────────────────────────────┘
 Layer 1          workflow/manifest.json      map: section -> file, size, owner role, read-when
                  ws.mjs                      builds role context packs, performs mechanical edits
 Layer 2          state hot file, per-area architecture Now, conventions, branch state
 Layer 3          decisions/, deviations/, ledger/, history/    cold: read by ID only
 Layer 4          specs/, plans/, tests manifest                per workstream
 Layer 5          docs/architecture/ (Target design), docs/guide/ (confirmed handover docs)
```

### Lifecycle

```
architect ──► slice ──► [per workstream]
 (Target)    (bridge)       tier? ──► spec ─► interfaces ─► plan ─┬─► test-authors (parallel, blind)
                                                                  │          │
                                                                  └─ approval ┘
                                                           implement (per task, fresh ctx) ─► verify
                                                                         │
                                                           review ─► approve ─► merge ─► fold ─► guide
```

Every arrow that is an approval gate (spec, plan, review) keeps today's rule: the agent asks one question and writes the owner's yes.

---

## 4. File layout and state redesign

### 4.1 `AGENTS.md` becomes a router (V2)

**Soft target ~3 KB, no hard cap (decided).** Keep it as short as the content allows, and justify growth; `ws budget` only reports. Contents:
- Branch model (`INT`, release branch) and where the manifest lives.
- Size tiers in one table (section 6).
- Gate table (names and order only; procedure is in skills).
- "Which skill for which task" pointers.
- The one-line read rule: **run `ws pack <role> [task]` to get your context; do not read state files directly.**

- **A one-line-each "update the record when" checklist** (the nine write-immediately triggers, reduced to short bullets). This is the one piece of procedure kept in the always-loaded file, because failing to record is the costliest failure mode and the `branch-state` skill may not be loaded in a Small-tier session. The *how* for each trigger lives only in the `branch-state` skill.
- A 4-5 line commit rule (5.2b).

Everything else (full trigger text, vocabulary, acid test, red flags, worked examples) lives only in skills.

### 4.2 Hot state and guardrails (V1, M10)

```
workflow/project-state/
  STATE.md            hot, ≤8 KB
  guardrails.md       ≤2 KB, always loaded
  architecture/<area>.md      "Now" per area + decision IDs (cold-ish)
  conventions/<topic>.md      read when writing code in that topic
  decisions/C014.md           one file per decision, ADR-style
  deviations/D007.md          one file per deviation
  lessons/L003.md             one file per lesson (5.7), role-scoped
  ledger/done-ledger.md       append-only
  ledger/YYYY-MM.md           rotated
  branch-states/<slug>.md     lean branch state (same folder name as MP3)
```

**Decided (Q1):** `PROJECT_STATE.md` leaves the repo root and becomes `workflow/project-state/STATE.md`. `AGENTS.md` names the path (and `workflow/config.json` records it), so nothing needs a root stub.

### 4.2a Whole-repo layout

```
AGENTS.md                      router (≤3 KB); both Claude Code and Codex read it
CLAUDE.md                      imports AGENTS.md only
workflow/
  config.json                  INT branch, build/test commands, enabled skills, state path
  models.json                  tiers -> model per provider; role/stage overrides (5.6)
  infra.json                   test dependencies (5.8)
  manifest.json                section -> file, size, owner role, read-when
  skills.lock                  vendored skill versions + checksums (8)
  agents/<role>.md             provider-neutral role definitions (5.1, 5.6)
  skills/<skill>/              vendored skills (source of truth for this project)
  tools/ws.mjs, lint.mjs       deterministic tooling (5.2)
  project-state/               as in 4.2 above
  specs/
    YYYY-MM-DD-<topic>-design.md  + <topic>-design/ folder (Big)
    YYYY-MM-DD-<topic>.md         (Medium: single file, the task list is the plan)
  plans/YYYY-MM-DD-<topic>.md
  history/                     closed iterations (was project-history/)
docs/
  architecture/                Target design from architecting-systems
  guide/                       index.md, <section>.md, map.json (4.4)
.claude/                       GENERATED: agents/, skills/ from workflow/ (5.6)
.codex/                        GENERATED: Codex equivalents (format to verify)
```

Changes from MP3: `PROJECT_STATE.md` moves under `workflow/project-state/`; that folder gains `architecture/`, `conventions/`, `decisions/`, `deviations/`, `lessons/` and `guardrails.md`; skills and agents become vendored under `workflow/` with `.claude/` and `.codex/` generated; `docs/guide/` replaces the single guide file; `workflow/specs`, `plans` and `branch-states` keep their MP3 names so existing habits and links carry over.

**Growth rules (soft).** `guardrails.md` holds only *active or high-risk* items; entries that no longer constrain work move to the cold folders. `STATE.md`'s decision index lists decisions currently binding, not every decision ever made; superseded ones drop out of the index but stay in `decisions/`. The index and `guardrails.md` do not duplicate each other: guardrails list prohibitions (Known Gaps, out-of-scope, binding decisions) and the index lists everything else that is currently decided. `ws budget` reports when either file exceeds its target and suggests which entries to archive.

**`STATE.md` (hot)** holds only: How to Resume, Workstreams table (status, one-line position, links), Upcoming, Needs a Human, and a **decision index** (ID, one-line final decision, link). Nothing else.

**`guardrails.md` (always loaded)** holds one line per: Known Gap, out-of-scope item, and binding decision, each with ID and a link to the detail file. This preserves the "collision with a recorded decision" check (the cost of getting it wrong is high) while keeping the load under ~2 KB. Detail is pulled by ID only when the task touches it.

**Cold folders** keep history out of every default read. Decision files carry: decision, who asked, why, rejected alternatives, date, supersedes/superseded-by. Agents open one by ID.

### 4.3 Branch state (V6)

**Design constraint (owner's choice, kept):** the branch state mirrors the project-state structure, so porting at fold is a copy, not a translation. Same section names, same entry formats, same ID forms (provisional `~`). At fold, `ws fold` copies each entry's text verbatim, renumbers its ID, and files it (a Decisions entry becomes `decisions/C014.md`; a Deviations entry becomes `deviations/D007.md`; a lesson becomes `lessons/L003.md`). Nothing is reworded or reshaped.

Within that constraint, trim the overhead:
- Required sections: Status, Base sha, How to Resume, Workstreams, Changes, Remaining/Handover. Other sections (Architecture Now, Conventions, Known Gaps, Decisions, Deviations, Lessons) exist only when the branch changes them.
- The per-section "No change." lines (five in a typical small branch) are replaced by **one line**: `Untouched: Architecture, Conventions, Known Gaps`. The explicit completeness claim stays; `sync` still runs the diff-based check (step 2a) against it.
- Sessions table stays inside How to Resume (preserves the mirror). Splitting it into a separate file is optional and only worth doing if merge conflicts on it are measured.
- **Changes lines are derived**, not typed: commits carry trailers `Workstream: W-x` and `Task: T3`; `ws changes <slug>` renders the list. Removes trigger 6 from the "write immediately" list for ordinary work.
- Cap: when Changes exceeds ~10 lines, `ws compact` moves completed ones to the plan (task detail already lives there) and keeps a count.

### 4.4 Developer Guide (V4)

```
docs/guide/
  index.md                links + status per section (≤3 KB)
  <section>.md            target ≤15 KB each
  map.json                source-path glob -> guide section(s)
```

- `update-documentation` receives the list of changed paths from the fold, calls `ws guide-targets`, and reads **only** the index and the affected sections.
- Checkpoint default changes from `feature` to `phase` (write once when a group of related workstreams is Done); `feature` remains available per project.
- Claim-versus-code verification (existing rule) stays, but now runs per section, which fits the agent's context.

---

## 5. Roles, scripts and context packs

### 5.1 Role contracts

Each role is defined once, provider-neutral, in `workflow/agents/<role>.md` (section 5.6), with a contract block that lint validates. Provider files (`.claude/agents/`, `.codex/`) are generated from it. The "Model" column below is a **tier** (`strong` / `mid` / `cheap`), resolved through `models.json`.

| Role | Does | Reads (pack) | Writes | Never touches | Returns | Model (to be validated, section 9) |
|---|---|---|---|---|---|---|
| `architect` | Target architecture via `architecting-systems`; decision rounds with the team | brief, requirements, `guardrails.md`, existing `docs/architecture/` | `docs/architecture/**` only | code, specs, plans, state | readiness-gate summary | strongest |
| `slicer` | Turns Target architecture into workstreams (section 7) | architecture sections, `STATE.md` workstreams, guardrails | workstream rows via `ws`, `workflow/project-state/architecture/<area>` stubs | code, specs | proposed workstream list with dependencies | strong |
| `spec-writer` | Spec for one workstream: behaviour, acceptance, edge cases, order. References architecture contracts by anchor, restates nothing | workstream row, cited architecture sections/contracts, relevant guardrail entries, spec templates | `workflow/specs/<topic>/**` | plan, code, state files directly | spec path, tier, open Qs | strong |
| `interface-drafter` | Compilable stubs from `api.md` / contracts (signatures, DTOs, `NotImplemented`) | spec api/data-model, conventions for layout | stub files only | tests, logic | file list | mid |
| `planner` | Plan from approved spec | spec, stubs list, conventions pack, repo file listing | `workflow/plans/**` | spec, code | plan path, waves | mid |
| `test-author` | Tests from spec and stubs, blind to implementation (6.3) | assigned spec components, stubs, edge-case rows, test conventions pack | test files only | production code, plan snippets | test list mapped to E/F IDs | mid |
| `implementer` | One task: make the red tests green | task section, its tests, stubs, conventions pack, spec components the task cites | production files listed in task | tests (read-only), state, spec | diff summary, build result summary | mid |
| `reviewer` | One lens over a target | review-context bundle (5.3), target | nothing | everything | structured findings (existing format) | mid |
| `state-clerk` | Residual state edits that scripts cannot do (decision text, deviation text) | branch state, item to record | state files via `ws` | code | confirmation | cheap (if validated) |
| `doc-writer` | Guide section updates | guide index, affected sections, changed-path diff | `docs/guide/**` | state, code | sections changed | mid |

The orchestrating (main) session is the only place that holds the conversation with the owner and asks gate questions. Subagents never ask the owner.

Enforcement: lint checks that each agent file declares reads/writes; a project `PreToolUse` hook can reject writes outside a subagent's declared paths (feasibility to confirm, Q5).

### 5.2 `ws.mjs` (deterministic tooling) (M1)

A single Node script, like `lint.mjs`, shipped with the skill set.

| Command | Replaces |
|---|---|
| `ws pack <role> [--task T3] [--workstream W-x]` | Reading whole state files; prints a role's context pack and its token estimate |
| `ws status <workstream> <status>` | Hand-editing status cells; validates vocabulary |
| `ws changes <slug>` | Hand-written Changes lines (from commit trailers) |
| `ws decision new/show/supersede` | Free-form decision edits; mints provisional IDs |
| `ws fold <slug>` | Mechanical part of `sync-project-state`: renumber IDs, move files, update index; leaves a diff for the agent to confirm |
| `ws guide-targets <paths...>` | Deciding which guide sections to read |
| `ws budget` | Size budgets (see 10) |
| `ws compact <slug>` | Branch-state growth cap |

The existing `lint.mjs` and `rebase-links.mjs` fold into this tool or sit beside it.

### 5.2a Commit trailers and the commit hooks (proposed, Q2)

A **git hook** (not a Claude or Codex feature), so it works identically for both agents and for humans. It is installed by `ws init` (`git config core.hooksPath .githooks`).

| Hook | When git runs it | What it does here |
|---|---|---|
| `prepare-commit-msg` | Before the message editor opens | Appends missing trailers automatically: `Workstream:` from the current branch state (when it has exactly one active workstream) and `Task:` from the session row's current task. The agent usually adds nothing by hand. |
| `commit-msg` | After the message is written | **Advisory only, never rejects.** Prints a one-line warning if the subject does not match `type: what and why`, a trailer is missing, or a provisional ID (`C~n`) is in the message. Merge, revert and fixup commits are skipped. |

**Policy (decided): manual commit messages are always allowed.** Humans may commit however they like. The structured format is what **agents** are instructed to use (5.2b). Nothing blocks a commit.

**Where `Task:` comes from (avoids a stale session row).** The hook does not read the branch state's session row. `ws task start T3` (run by the executing agent at the start of each task, and by each parallel subagent in its own worktree) writes a small gitignored file `.ws/current-task` in the **current worktree**. `prepare-commit-msg` reads that file. If it is absent, the hook adds no `Task:` trailer rather than guessing, and `ws changes` shows the commit as "no task". `Workstream:` is added only when the branch state has exactly one active workstream; otherwise nothing is added. Parallel worktrees therefore never share a pointer. `ws task done` removes the file.

Trailers look like this:

```
feat: host calendar blocks overlapping bookings

Workstream: W-HOST
Task: T3
```

How they feed the record:
- `ws changes <slug>` reads `git log` for the branch and renders the branch state's Changes list (subject plus workstream/task).
- It runs at close-out, **before** the merge, and the result is committed in the branch state. This avoids depending on trailers surviving a squash merge.
- Commits without trailers (manual commits, or a skipped hook) are still counted: `ws changes` falls back to the subject line and attributes the commit to the branch's active workstream, flagging it "no trailer" in the output so the author can correct it.
- CI does **not** check commit message format. It keeps the existing branch-state gate (`check-branch-states.sh`: approved, no live session rows), which is what matters for the record.
- Hand-written Changes lines remain allowed for Big work where the commit subject is too terse.

### 5.2b Where the commit rule lives

Yes, it is specified, in two places, because commits happen in every tier (including Small, where no skill runs):

| Place | Holds |
|---|---|
| `AGENTS.md` (always loaded, ≤3 KB) | A 4-5 line rule: one logical change per commit, message `type: what and why`, add `Workstream:` and `Task:` trailers when working under a workstream, never cite provisional IDs, and a link to the detail below. |
| `branch-state` skill, reference file `commits.md` | The full convention: allowed types, trailer names and values, granularity (per plan task, builds green, a handful of files), what the hooks add automatically, examples. `executing-plans-lite` and `ws changes` point here. |

The detail currently in MP3 `AGENTS.md` § 6 (small commits, green builds, file counts) moves into `commits.md` so the always-loaded file stays short.

### 5.3 Context packs and review bundles (V5)

`ws pack reviewer` builds a bundle (≈3-5 KB) once per review round: the relevant architecture areas' Now, applicable conventions, guardrail entries touching the target, and the out-of-scope list. All lenses receive the same bundle; none opens the state file. Reviewer agents drop "read `PROJECT_STATE.md`" from their instructions.

### 5.4 Context lifecycle and handoff (V7, M3)

- Default: **one fresh context per task** (or per wave when tasks are tiny). The resume mechanism (first unticked box) already supports it.
- Each plan task ends with a capped **Notes for next task** block (≤3 lines: what was tricky, what was chosen and why, what to watch). Not a diary; deleted at fold. Surviving rationale that matters becomes a decision file.
- At stage end each role emits a ≤1 KB **handoff** into the next role's pack (what was produced, open questions, paths). The conversation itself is not the handoff.

### 5.5 Quiet verification (M2)

Build and test commands run through a wrapper that prints a pass/fail line, failing test names and the first N lines of each failure; full logs go to a file the agent reads only on request. Where a stage allows, a subagent runs the suite and returns the summary.

### 5.6 Provider-neutral agents and model config (M12, V8)

Skills and role contracts are written once, free of provider syntax. Provider details are generated.

```
workflow/
  agents/<role>.md          provider-neutral: purpose, instructions, reads, writes, forbidden,
                            return format, capability tier, reasoning level, abstract tool needs
  models.json               the only place model names appear
  skills/                   vendored skills (section 8)
.claude/agents/<role>.md    GENERATED by `ws adapters claude`
.codex/...                  GENERATED by `ws adapters codex`
```

`models.json` is the customisation point:

```json
{
  "tiers": {
    "strong": { "claude": "<model id>", "codex": "<model id>" },
    "mid":    { "claude": "<model id>", "codex": "<model id>" },
    "cheap":  { "claude": "<model id>", "codex": "<model id>" }
  },
  "reasoning": { "high": {}, "medium": {}, "low": {} },
  "roles":  { "reviewer": { "tier": "mid", "reasoning": "medium" } },
  "overrides": { "stage:implement": { "tier": "mid" } }
}
```

- Roles name a **tier** and a **reasoning level**, never a model. Changing a model, a provider or one role's tier is a one-line edit followed by `ws adapters`.
- Per-role, per-stage and per-tier-per-provider overrides are all supported; the experiment (section 9) reads and writes this same file.
- Answer to "dedicated `.claude` and `.codex` folders?": **yes, but as generated adapters**, not hand-maintained. Hand-maintaining two copies recreates the drift problem.
- Provider differences are declared in the adapter, not in the role: a provider that cannot restrict a subagent's tools relies on the lint and post-run diff check for write-scope (section 5.1) instead of a hard block. To verify before building the Codex adapter: its current subagent and skill discovery locations and config format.
- `AGENTS.md` stays the shared router (both tools read it); `CLAUDE.md` only imports it.

### 5.7 Recording decisions, mistakes and lessons (V7, M11)

Current behaviour (verified): the operator's decisions are recorded via trigger 4; plan divergences go to Deviations. Not covered: (a) answers to the agent's own questions that are small but binding, (b) the agent's mid-task implementation choices, (c) agent mistakes and the operator's corrections.

Changes:
1. **Every answer to a question the agent asks the operator is a candidate decision.** `ws decision new` makes recording one command (who asked, the answer, why, rejected options). Gate answers (approvals) are already recorded; this extends it to any `AskUserQuestion`-style exchange that settles a design or scope point. Trivial preferences can be marked `local` and kept in the branch state only.
2. **Implementation choices** (the ConcurrentHashMap example in P8) go in the plan's capped Notes for next task (5.4); those that outlive the task become decisions at fold.
3. **New record type: lesson.** Created when the operator corrects the agent, a review finds an avoidable error, or the agent catches its own. Fields:

   | Field | Content |
   |---|---|
   | ID, date | `L~n` provisional, `L003` after fold |
   | What happened | one or two lines |
   | Cause | misread spec, stale assumption, skipped check, tool misuse |
   | Rule | the instruction that prevents it, one line, imperative |
   | Scope | `project` (about the codebase) or `role:<name>` (about how that agent works) |
   | Found by | operator / reviewer / self |

4. **Loading.** Lessons are not read in bulk. `ws pack <role>` includes lessons scoped to that role plus project lessons matching the task's area. A lesson repeated or broadly applicable graduates into § Conventions (project) or the role's instructions (agent behaviour), and the lesson file is marked `graduated`.
5. **Trigger and policy (decided).** Added to the router's "write immediately" list. When the **operator** corrects the agent, the agent asks whether to record the correction as a lesson. When a review exposes an error or the agent catches its own, the agent decides.

### 5.8 Shared test infrastructure (M13)

**Problem.** Test runs repeatedly pay for things that do not change between runs: starting dependencies (databases, emulators), migrating schemas, and building the application's runtime context. Starting extra short-lived dependencies per test class or per run also raises memory use. Evidence from MP3 (one example, not the scope): the Java backend started a Postgres container per test JVM plus extra containers in a few test classes, rebuilt Spring contexts on every Gradle invocation, and left `hs_err_pid*.log` files showing the JVM out of native memory on a developer machine. The lessons below are stated so they apply to any stack, including MP4's TypeScript, Prisma and Firebase setup.

**General learnings**

| # | Learning | Applies to any stack as |
|---|---|---|
| 1 | **Separate what is expensive and stable from what is cheap and changing.** Start dependencies once, run tests many times on top. | A persistent local service for databases and emulators; tests only connect. |
| 2 | **Pay for schema setup once.** Migrate once into a template; make a per-use copy cheaply. | Template database cloned per worker or class (Postgres `TEMPLATE`), or a snapshot/restore equivalent. |
| 3 | **Isolation by name, not by hope.** Every concurrent runner (test worker, parallel subagent worktree, tester/implementer split) gets its own namespace. | Database or schema names derived from worktree and worker id; never a shared mutable database. |
| 4 | **Tests find their dependencies through configuration, with a self-contained fallback.** | Read a connection URL from the environment; if unset, start a throwaway dependency (Testcontainers or equivalent) so CI and teammates still work. |
| 5 | **One place starts each dependency.** Ad hoc starts scattered through test classes multiply cost and are hard to audit. | One shared base class or setup file per stack; a lint rule flags stray container or server starts. |
| 6 | **Know which cost infra cannot fix.** Runtime-context startup (for example a framework's application context) is paid per distinct configuration per process. | Reduce the number of distinct test configurations: shared base classes, shared mock sets, smaller test slices instead of the whole application, no tests that force a rebuild. |
| 7 | **Bound parallelism by memory, not by core count.** Each worker's runtime and connection pool consume RAM. | Cap parallel workers and pool sizes against available memory. |
| 8 | **Measure before and after; adopt only what helps on the team's machines.** | Baseline a full run and a single-test run (wall time, peak memory); compare after each step. |

**Decision proposed: keep dependencies running; test code only connects.**

1. `workflow/infra.json` declares the services a project's tests need: image, port, health check, and for databases the migration command and the files whose hash decides when it reruns.
2. `ws infra ensure` is idempotent: starts missing services, waits for health, rebuilds the template database only if the migration hash changed. It runs at the start of the quiet test runner (5.5), so a batch session starts dependencies once and runs all tests on top. Other commands: `status`, `db <name>` (clone), `drop`, `down`.
3. Per-worker clones are named `test_<worktree>_<worker>`. For tests that cannot roll back a transaction, use clone-per-class or truncate between tests, not per-test migration.
4. Tests read `TEST_DATABASE_URL` (and similar variables per service) and fall back to a throwaway dependency when it is unset.
5. Lifecycle: lazy start, then stay up for the session; optional idle shutdown. One idle dependency is lighter than several short-lived ones plus their runtimes; measure its memory before relying on that.
6. Other dependencies (for example an auth emulator) are declared in the same file.

**Alternatives considered**

| Option | Verdict |
|---|---|
| Library-managed reuse of a throwaway container (for example Testcontainers reuse) | Cheaper than starting per run; experimental, containers outlive runs, per-worker isolation stays manual. Acceptable as the fallback tier. |
| Always-on application server with black-box HTTP tests | Loses control over mocks and configuration; reserve for a few end-to-end smoke tests. |
| In-memory substitute for the real database | Rejected when production behaviour matters: divergence risk. |
| Only tune the number of runtime contexts | Does not remove start and migration cost; do alongside, not instead. |

### 5.9 Runtime dependencies and fallbacks

**Current state:** the skills already need Node. `writing-specs-lite/scripts/lint.mjs` is called by `writing-specs-lite`, `writing-plans-lite` and `executing-plans-lite`, and `refresh-project-state/rebase-links.mjs` is another script. MP3 (Java) therefore already depended on Node for tooling. `ws` extends that dependency; it does not create it.

**Why Node is still a reasonable choice:**
- Cross-platform without shell differences (the team uses Windows; Bash scripts would need Git Bash).
- Native JSON handling, which `manifest.json`, `models.json`, `infra.json` and the lock file need.
- MP4's own stack is Next.js/TypeScript, so every developer on MP4 has Node anyway.
- Claude Code and Codex can both run it.

**Rules that keep the dependency safe:**
1. **No npm dependencies.** Node standard library only, one file or a few, so there is no install step and nothing to audit.
2. **Pinned minimum Node version** in `config.json`; `ws doctor` reports Node, git, Docker and the other tools it needs, and what is missing.
3. **Every skill keeps a manual fallback, in a separate file** (`fallback.md` beside the skill), loaded only when `ws doctor` reports Node unavailable, so the normal SKILL.md stays short. It says what `ws` does in plain steps (read these sections, write this line). Without Node the workflow is slower and costs more tokens but still works. Scripts are accelerators and enforcement, not the only way.
4. **A project that cannot use Node** (not expected for this team) can replace `ws` later; the commands are a stable interface and the skills call only that interface.

**Effect on the commit hooks (Q2):**
- Git hooks run a tiny shell shim that calls `node workflow/tools/ws.mjs hook <name>`. The shim does `command -v node || exit 0`: if Node is missing it **warns and lets the commit through**, so a missing tool never blocks work.
- Hooks are not part of a clone. Each collaborator must run `ws init` once (MP4 adds it to `package.json` as a `prepare` script so `npm install` does it). Anyone who has not will skip the hooks.
- Because the hooks are advisory (5.2a), a skipped or missing hook costs nothing worse than a missing trailer, which `ws changes` handles by falling back to the subject line.
- The trailer format itself needs only git: a developer without Node can still write `Workstream:` by hand.

---

## 6. Tiers and test-first flow

### 6.1 Three tiers (V3)

| Tier | When | Artifacts | Review | Tests |
|---|---|---|---|---|
| **Small** | Bugfix inside existing design, copy/style, config | none; commit trailers produce the record | none | add or adjust tests inline |
| **Medium** | Scoped corrections, new endpoint on an existing surface, small UI addition | **one file** (<~4 KB): problem, goals, non-goals, contract delta, edge cases, task list. The task list is the plan. | 1 reviewer, Implementer lens | test-author optional |
| **Big** | New capability, schema/model change, security-sensitive, cross-cutting | full spec folder + plan (today's flow, with packs) | lenses by risk tier | blind test authoring |

Ambiguous size defaults to Big, as today, but the router asks the one-line question "does this change a contract, a schema, or permissions?" first; if no, it's Medium.

### 6.2 What the spec-writer no longer does

The spec-writer plans only behaviour and architecture deltas and the task order. It does not write implementation code or tests. Contract material (signatures, field lists, JSON shapes, error codes) remains in the spec as today. It cites architecture contracts by anchor (`contracts.md#create-room`) rather than restating them, which keeps component files short and prevents divergence.

**Code snippets stay, in the plan.** Snippets exist to carry what only the planning session knew: tricky schema and migration SQL, algorithms, rounding, state transitions, concurrency and transaction handling. The current rule (`writing-plans-lite` rule 3) is kept. Two refinements:
- Each snippet carries a visibility tag: `[contract]` (schemas, signatures, message strings, migrations whose shape tests depend on) or `[impl]` (algorithm and logic hints). `test-author` packs include `[contract]` snippets and exclude `[impl]` ones, so blind authoring is not contaminated by the intended implementation.
- Snippets are marked as intended shape, and the implementer adapts them to the real code and notes why in the commit message (existing rule). `lint` checks that every snippet names its task and tag.

### 6.3 Blind test authoring (M9)

```
approved spec ─► interface-drafter (stubs compile, throw NotImplemented)
              ─► planner (T0 contracts task + tasks) ────────────┐
                        │ parallel, while plan is in review       │
                        ▼                                         │
          test-author ×N  (one per task or wave)                  │
          sees: spec components, stubs, E-rows, test conventions  │
          never sees: plan snippets, implementation               │
                        ▼                                         ▼
               red-tests commit  ◄── plan approval covers the test list
                        ▼
          implementer per task: tests are read-only; green them
```

Rules:
1. Stubs must compile so tests can fail for the right reason. A test that fails to compile is not red.
2. Each test cites an `E`/`F` ID; a tester-lens reviewer checks every E row has a test (replaces the plan-side assignment step).
3. If the implementer believes a test is wrong, it stops and records a Deviation; the spec or the test changes through change control, never silently.
4. Disagreement between independently written test and implementation is treated as **spec ambiguity found**, a useful signal, not a failure of the process.
5. Fixtures and setup are the main risk (a blind author guesses wrongly). Mitigation: the conventions pack names shared test base classes, builders and data seeds.

This is the user's idea, refined; the hand-off point (plan approved, tests integrated, then implementation) is kept.

### 6.4 Two test layers (decided)

| Layer | Written by | Covers | When |
|---|---|---|---|
| **1. TDD tests** | The planner puts them in every task's checklist (failing test, implement, green, as `writing-plans-lite` already does); the **implementer** writes and owns them | Every task, including internal helpers and non-contract units that a blind author cannot see | Always (Medium and Big) |
| **2. Blind contract tests** | `test-author`, from spec plus stubs only | The public contract: API behaviour, permissions, money and state transitions, edge-case rows | Required for High-risk tier and for tasks the spec marks `critical`; recommended for Medium; skipped for Small and Low |

Rules:
1. Layer 1 stays as basic TDD inside each task. Layer 2 adds depth and independence for the features that matter most; it does not replace Layer 1.
2. Blind tests live apart from the implementer's tests (for example a `contract/` folder or `*.contract.test` suffix) and are read-only to the implementer (6.3 rule 3).
3. The implementer may add more tests of its own but may not edit or delete blind tests.
4. **Cost if work is discarded.** Blind tests derive from the *approved spec* and the stubs, not from the plan, so a rejected or reworked plan does not waste them. They are wasted only if the spec is amended, which already triggers change control. Test authoring therefore starts after spec approval and stub review, in parallel with plan review.

---

## 7. Architecture ⇄ state integration (M8)

### 7.1 Separate Target from Now

| | Target architecture | State § Architecture (Now) |
|---|---|---|
| Describes | Intended design, decisions, contracts | What is built and merged |
| Lives in | `docs/architecture/` (MP4 already has `agile-platform-architecture.md`, `contracts.md`, `concerns.md`, `decision-log.md`, `delivery-plan.md`) | `workflow/project-state/architecture/<area>.md` |
| Written by | `architect` (via `architecting-systems`) | `ws fold` from branch states |
| Statuses | Given / Gap / Proposed / Decided / Assumed / Deferred / Out of scope | Now, plus the IDs that shaped it |
| Question answered | "What should we build and why?" | "What exists today?" |

Each state area file ends with a **Target link and drift note**: which architecture section it realises and what differs. `ws drift` lists areas whose Now diverges from Target.

### 7.2 New bridge skill: `slicing-architecture`

Runs after the architecture passes its readiness gate and whenever the architecture gains decisions.

1. Read the readiness gate and the delivery plan; read `STATE.md` workstreams.
2. Cut the architecture into **vertical workstreams** (one capability across layers), noting for each: the architecture sections and contracts it realises, requirements it traces to (F/N), dependencies on other workstreams, areas it will change, and a suggested tier.
3. Write workstream rows (status `Not started`) with links to those sections; create area stubs under `state/architecture/`.
4. Report architecture items that no workstream covers, and workstreams that cite no architecture (both are findings).
5. Ask the owner to confirm the slicing (a gate).

Result: a traceability chain, enforced by lint where IDs allow.

```
requirement ─► architecture component/contract ─► workstream ─► spec F/N ─► plan T ─► test E ─► commit trailer
```

### 7.3 ID hygiene

`architecting-systems` uses `D-nn` for decisions; state uses `C<nn>`. Namespaces become explicit: architecture decisions keep `AD-nn` (renamed from `D-nn` on adoption); project decisions keep `C`; deviations `D`. The state decision index lists both, so one lookup finds any.

**Legend rule (decided).** Every template table that holds IDs opens with a one-line legend naming its notation, because `AD` and `D` look alike. Examples:
- Architecture decision log and each decision table: `Legend: AD = Architecture Decision (intended design). G = architecture gap. Not to be confused with D<n>, a Deviation in project state.`
- State § Deviations table and the branch state's Deviations section: `Legend: D = Deviation, where reality diverged from a spec or plan. Not to be confused with AD-nn, an Architecture Decision.`
- § Decisions: `Legend: C = project decision. AD-nn entries are in docs/architecture.`

This is added to the `architecting-systems` document template, the `project-state` and `branch-state` templates, and checked by lint.

### 7.4 Feedback loop

A spec that finds an architecture gap raises it back to `architect` as a new Gap (not a silent spec decision). A fold that changes an area's Now updates the drift note. The `architect` role can be re-invoked in "review" mode against built reality.

---

## 8. Skill inventory (cohesion)

Target shape: one thin **router** plus stage skills that all use `ws` and the same IDs and vocabulary.

| Skill | Fate | Change |
|---|---|---|
| *(new)* `workflow` (router) | **New** | Entry skill. Resolves branch/tier/stage, runs the "open gates first" check, calls `ws pack`, names the next skill. ≤3 KB. Replaces most of `AGENTS.md`'s procedure. |
| `architecting-systems` | Keep | Output path fixed to `docs/architecture/`; `AD-nn` IDs; add "hand off to `slicing-architecture`" at the readiness gate. |
| *(new)* `slicing-architecture` | **New** | Section 7.2. |
| `maintaining-project-state` | **Split in two (decided by owner)** | There is currently **no standalone branch-state skill**: branch-state rules live inside this skill (`branch-state-template.md`, lifecycle, approval gate) and `sync-project-state`. Almost every agent on a branch needs only the branch-state half, and only sync/owner hotfixes need the project-state half. Split into `branch-state` (all agents on a branch: template, write-immediately triggers, session rows, lessons) and `project-state` (structure of the hot/cold files, bootstrapping, reconciliation; used by `sync` and the owner). Both stay mirrored in structure (4.3), and each SKILL.md is a ~3 KB router with details on demand. Mandate changes to `ws pack`. |
| `writing-specs-lite` | Keep, **slim** | Tier-aware; medium single-file template added; reads by pack; reviewer bundle; references contracts by anchor; no code or tests. |
| *(new)* `drafting-interfaces` | **New** (may be a step inside spec skill) | Stubs from the contract. |
| `writing-plans-lite` | Keep, **slim** | Plan references stubs and tests; adds T0; Notes-for-next-task block; no embedded code except where needed. |
| *(new)* `authoring-tests` | **New** | Blind test authoring (6.3) and red-commit rule. |
| `executing-plans-lite` | Keep, **adapt** | Fresh context per task; tests read-only; quiet verification; no inline state editing (calls `ws`). |
| `sync-project-state` | Keep, **mechanise** | Uses `ws fold`; agent confirms the diff and resolves stale-base conflicts only. |
| `refresh-project-state` | Keep, **simplify** | Largely subsumed by cold folders and ledger rotation; remains owner-run for phase closure. |
| `update-documentation` | Keep, **adapt** | Section files, `map.json`, `phase` checkpoint default. |
| `logging-agent-interactions` | Keep | Unchanged (out of the context-lean path). |
| `reviewed-plan` | Keep, opt-in | Stays available by name only. |
| `lite-reviewer` agent | **Update** | Pack-based reads, `model` set per experiment result. |
| MP3 project skill copies | **Keep vendored, one-directional** | Copies exist for collaboration (collaborators may not have the user-level skills). They are replaced by synced copies; superseded ones not named in the project's config are removed. |

### Managed vendoring and project config (M5)

**Rule (decided): all skill changes are made at the user level only, then synced into the project.** A project copy is never edited in place; a fix found while working in a project is made in the user-level skill and synced.
- `workflow/skills.lock`: skill name, source version, content checksum.
- `ws skills sync`: copies the user-level skills the project enables into `workflow/skills/`, shows a diff, updates the lock. It is the only writer of that folder.
- `ws skills check` (lint): fails on a vendored skill whose checksum differs from the lock (someone edited the project copy), and on skills present but not listed in config. There is no override mechanism.
- Collaborators receive updates through the normal git history of `workflow/skills/` (the synced copy is committed), so they need no user-level skills of their own.
- Generated adapters (`.claude/skills`, and the Codex equivalent) are produced from `workflow/skills/` so both providers see one set (5.6).

`workflow/config.json` per project: `int_branch`, `release_branch`, build/test commands per component, guide checkpoint, tier defaults, `delegation` (`hybrid` default, `minimal`, `orchestrator`; Q4), enabled skills, minimum Node version, and the path to `models.json`. Skills read it via `ws`.

---

## 9. Model routing: hypothesis and experiment (V8, W2)

**Status: hypothesis only.** The MP3 table is directional. Prices must be re-pulled for the current model family when the experiment is run. Which models fill which tier is decided by the team (9.5).

### 9.1 Initial hypotheses

| Stage | Hypothesis | Rationale |
|---|---|---|
| architect, slicer, spec-writer | strongest model | Trade-offs, security reasoning; low volume |
| interface-drafter, planner, test-author, implementer, reviewer, doc-writer | mid model | Structured, checkable output |
| state-clerk, quiet-verification summarising | cheapest model | Only if validated; scripts take most of the load first |
| Main orchestrating session | owner's choice; keep short by delegating | Gate conversations are low-reasoning but must be reliable |

### 9.2 Experiment design

Run replays against **real MP3 artifacts** so no new project is needed.

| Role under test | Fixture | Ground truth | Candidates |
|---|---|---|---|
| reviewer | MP3 specs (W-HOST-EXPERIENCE-CORRECTIONS small; W-AI-AGENT large) with 5-8 **seeded defects** (contradiction, missing error, Known Gap collision, wrong path, vague term) plus the original Opus findings | Seeded set + baseline findings | strong, mid, cheap |
| state-clerk | 20 recorded events (task finish, decision, deviation, session handoff) | Expected branch-state diff, scored by `ws` validation and the acid test | mid, cheap |
| test-author | 3 MP3 tasks with existing tests | Existing tests as reference: mutation score of generated tests against the real implementation, E-ID coverage | strong, mid |
| implementer | 3 MP3 plan tasks (revert, re-implement against the red tests) | Tests pass, diff size, convention lint | strong, mid |
| planner | 2 approved specs | `lint.mjs plan` clean plus reviewer blocking-finding count | strong, mid |

Each cell runs 3 times (variance). Record per run: input and output tokens, wall time, cost at current prices, pass/fail, defect recall, false-positive rate.

### 9.3 Decision rule

Adopt the cheaper model for a role only if, across runs:
1. recall of seeded **blocking** defects ≥ 95% of the stronger model's recall, and no missed Known-Gap collision;
2. the output passes `ws`/`lint` validation at the same rate (state-clerk: 100% acid-test pass);
3. total cost is lower after counting retries.

Otherwise keep the stronger model for that role. Result recorded in `models.json` (5.6) and reviewed per model-family change.

**Customisable by design.** Nothing in a role definition, skill or script names a model. The experiment harness takes a list of `{provider, tier-or-model, reasoning}` candidates from a file, so adding a new model or provider is a config change. Defaults ship as suggestions marked unvalidated until an experiment confirms them for that project.

### 9.5 Defaults and who decides (decided)

| Tool | Default model | Default reasoning |
|---|---|---|
| Claude Code | Sonnet 5.5 | medium |
| Codex | GPT-6.1 Sol | medium |

- The defaults apply to every tier until an experiment says otherwise; a project with no `models.json` entries behaves as if all roles use the default.
- **The exact model for each tier (`strong`, `mid`, `cheap`) is the team's decision**, not this design's. The design does not name a "strongest" model, and Fable 5.1 is explicitly **not** part of the strongest-tier candidates.
- The model for each tier is **confirmed with the operator during the experiments** (9.2): before a run, the harness lists the candidate models for that tier and asks the operator to confirm or change them; the confirmed choice is written to `models.json`.
- The §9.1 hypotheses (strongest, mid, cheapest) are therefore only a tier shape; they do not assume particular models.

### 9.4 Other levers to test

- Fast mode for the implementation loop (note: it is the same model, faster output, so it saves time rather than cost; do not count it as cost routing).
- Main-session effort level per stage.

---

## 10. Measurement and budgets (M6, W4, W5)

| Measure | How | Initial target |
|---|---|---|
| Tokens at stage start | session usage at first work call, per stage and role, **above the harness baseline** (system prompt and tool list, measured once in phase 0 for each tool) | Targets set after the baseline is known; initial guess ≤15K for a subagent and ≤25K for the main session above baseline |
| Loaded vs referenced share | sample: which loaded sections the agent cited | ≥ 60% |
| Per-file size budgets (**soft**) | `ws budget` reports files over target and suggests moving items to cold storage; it warns, never fails (decided: no hard caps) | `AGENTS.md` 3 KB, `STATE.md` 8 KB, guardrails 2 KB, skill router 3 KB, guide section 15 KB, medium spec 4 KB, branch state 8 KB (soft) |
| Review round cost | summed subagent usage | ≥ 50% below the MP3 estimate |
| Quality guard | seeded-defect recall; decision-collision catches in dry runs | no regression vs MP3 baseline |

Baseline: measure one MP3-style session with the current skills first, so improvements are real.

---

## 11. Migration plan

| Phase | Work | Verifies |
|---|---|---|
| 0 | Baseline measurement (tokens per stage above the harness baseline, per tool; sizes of current files); no new tooling beyond a throwaway measuring script | Numbers to beat; shows where tokens actually go |
| 1 | **Files and conventions only, no new scripts.** (a) Hot/cold state layout (4.2, 4.2a) with `STATE.md`, `guardrails.md`, per-item cold folders; (b) `manifest.json` as a **hand-written read-list** per role and task; (c) split `maintaining-project-state` into `branch-state` and `project-state` skills as thin routers with reference files; (d) slimmed `AGENTS.md` (router, update-the-record checklist, commit rule); (e) branch-state template with optional sections and the `Untouched:` line; (f) legend rule in templates; (g) `commits.md` | V1, V2, V6, M1, M4 |
| 1a | Only after phase 0 data shows where tokens go: `ws pack` (generate packs from `manifest.json`), `ws status`, `ws changes`, `ws budget`, commit hooks, `ws init` / `ws doctor` | M1, M2 |
| 1b | `workflow/infra.json`, `ws infra`, quiet test runner that ensures dependencies, shared test setup with environment-variable/throwaway-dependency fallback (5.8) | M2, M13 |
| 2 | Reviewer bundles; reviewer agent update; tier selection and medium template | V3, V5 |
| 3 | `architecting-systems` output path + IDs; `slicing-architecture`; area files with Target links | M8 |
| 4 | Role agents with contracts in `workflow/agents/`, `models.json`, `ws adapters`; `interface-drafter`, `authoring-tests`; executing-plans adapted (fresh context, read-only tests, quiet verification); lessons and `ws decision` | M2, M3, M9, M11, M12 |
| 5 | Model routing experiments (section 9); write result into config | V8 |
| 6 | Guide split, `map.json`, `phase` checkpoint | V4 |
| 7 | `sync` via `ws fold`; replace project skill copies with synced ones (`ws skills sync`) and remove superseded skills; migrate MP3 state as a trial | M5, end-to-end |

Phases 1-2 deliver most of the saving and are independently useful. Each phase ends with re-measurement.

MP4 is the proving ground: it starts fresh, so adopt the new layout from the first state file instead of migrating a large one. MP3 can be migrated afterwards as a stress test of `ws fold` on a large history.

---

## 12. Risks and open questions

### Risks

| Risk | Mitigation |
|---|---|
| Lean context causes missed decisions | `guardrails.md` always loaded; seeded collision tests; `sync` diff checks stay |
| Blind tests mismatch fixtures | Conventions pack with test base classes and builders; allow one clarification loop to the planner |
| Script bugs corrupt state | `ws` is deterministic and unit-tested; edits are small diffs reviewed at commit; lint after each write |
| More files means more navigation | Manifest plus `ws pack` hides the map from agents; humans use `STATE.md` index |
| Role write-scope not enforceable | Fall back to lint plus post-run diff check; revisit a hook later |
| Over-engineering for a term project | Phases 1-2 are the minimum viable change; later phases are optional per project |
| Commit-trailer discipline slips | `ws changes` warns on commits without trailers; Small tier can use a bare `Workstream:` |

### Open questions for the owner

1. **Q1.** *(Resolved: moved to `workflow/project-state/STATE.md`; layout in 4.2a.)*
2. **Q2.** *(Resolved: trailers are the source of Changes lines. Hooks only auto-fill and warn; manual commit messages are always allowed; agents follow the format given in `AGENTS.md` and `commits.md` (5.2a, 5.2b).)*
3. **Q3.** *(Resolved: architecture decisions are renamed `D-nn` -> `AD-nn` ("Architecture Decision"), so they no longer collide with state Deviations `D<n>`. MP4's `docs/architecture/` files need the rename.)*
4. **Q4.** *(Resolved: **hybrid is the default**. The main session runs the conversational stages and all approval gates itself (architecture rounds, spec clarification). It delegates fixed-input stages: test authoring, reviews, per-task implementation, parallel tasks, doc updates. The level is a `config.json` setting, so a project can choose `minimal` or `orchestrator`.)*
5. **Q5.** *(Resolved: skip the `PreToolUse` write-scope hook for now. Use `ws verify-scope`, a post-run diff check against each role's allowed paths. Revisit the hook if violations occur.)*
6. **Q6.** *(Resolved: vendored per project with a lock file, because collaborators need the same skills; user-level is the authoring source. See 8.)*
7. **Q7.** *(Resolved: a single-file Medium spec is acceptable for CS3227.)*
8. **Q8.** *(Resolved, accepted: one `Untouched: ...` line replaces the per-section "No change." lines.)*
9. **Q9.** *(Resolved: when the operator corrects the agent, the agent asks whether to record it as a lesson. In all other cases, such as a review finding or the agent catching its own error, the agent decides.)*
10. **Q10.** Which AI coding tools must the adapters cover first? "Provider" here means the tool that reads the agent and skill files, not the model vendor. Candidates: Claude Code (current), OpenAI Codex CLI, and possibly Gemini CLI, GitHub Copilot or Cursor. Each has its own agent/skill file format and subagent model, which must be verified before its adapter is built. *(Resolved: the team uses Claude Code and Codex only, so adapters cover those two. The Codex agent and skill formats are still to be verified before its adapter is built.)*
11. **Q11.** *(Resolved: a persistent local Postgres is acceptable, with Testcontainers kept as the fallback for CI and teammates.)*

---

## Appendix A: `ws` command reference (proposed)

`ws` is one Node script (`workflow/tools/ws.mjs`), run as `node workflow/tools/ws.mjs <command>`. Everything it does is deterministic: no model calls. Commands that change files print a diff summary and run lint on the result. Nothing here exists yet.

| Command | Purpose | Replaces | Section |
|---|---|---|---|
| `ws init` | Create `workflow/` skeleton and config; install git hooks (`core.hooksPath`) | Manual bootstrap | 5.2a |
| `ws pack <role> [--task T3] [--workstream W-x]` | Print a role's context pack (files and excerpts it should read) with a token estimate | "Read the state file in full" | 5.2, 5.3 |
| `ws status <workstream> <status>` | Set a workstream's status; validates the vocabulary | Hand-editing status cells | 5.2 |
| `ws changes <slug>` | Render the Changes list from commit trailers | Hand-written Changes lines | 5.2a |
| `ws decision new / show / supersede` | Record a decision (who asked, why, rejected options); mint provisional `C~n` | Free-form edits | 5.7 |
| `ws lesson new / show / graduate` | Record or retire a lesson | (new) | 5.7 |
| `ws fold <slug>` | Mechanical part of the sync: renumber IDs, file entries into `decisions/`, `deviations/`, `lessons/`, update the index and ledger; leaves a diff to confirm | Hand-folding | 4.3 |
| `ws compact <slug>` | Move completed Changes lines out of a long branch state | Manual trimming | 4.3 |
| `ws budget` | Check file sizes against the budgets | (new) | 10 |
| `ws drift` | List areas whose built "Now" differs from the architecture Target | (new) | 7.1 |
| `ws guide-targets <paths...>` | Map changed source paths to guide sections | Reading the whole guide | 4.4 |
| `ws verify-scope <role> [--base <ref>]` | Compare the git diff to the role's allowed paths | Write-scope hook (skipped) | 5.1 |
| `ws infra ensure / status / db <name> / drop / down` | Start test dependencies, build the template database, clone per-worker databases | Per-run containers | 5.8 |
| `ws adapters claude / codex` | Generate `.claude/` and `.codex/` files from `workflow/agents/` and `models.json` | Hand-written provider files | 5.6 |
| `ws skills sync / check` | Copy enabled user-level skills into `workflow/skills/` and update `skills.lock`; verify project copies against the lock | Unmanaged copies | 8 |
| `ws task start <T> / done` | Write or remove the per-worktree `.ws/current-task` pointer used by the commit hook | Stale session-row lookups | 5.2a |
| `ws doctor` | Report Node, git, Docker and other tool availability | Silent failures | 5.9 |
| `lint.mjs spec / plan` (existing) | Spec and plan structure checks | already exists | MP3 |
