---
name: writing-specs-lite
description: Use when a feature-level change needs a design spec before any plan or code (AGENTS.md § 3 "Big"), or when the operator says write/draft a spec. A lightweight alternative to superpowers brainstorming - produces a small set of focused spec files (problem, data model, APIs, conventions, edge cases, implementation order with a dependency table), reviewed from several perspectives and sized to the change's risk.
---

# Writing Specs (lite)

A spec says **what the system must be and how it must behave**, never **how to build it step by step** (that is the plan). It is written so that an implementer has no decision left to make by guessing.

**Announce at start:** "I'm using writing-specs-lite to write the spec."

## Hard rules

1. **Not a mega-document.** One short index file plus one file per component (below). No component file should need scrolling to understand.
2. **No implementation detail.** No code bodies, no step lists, no "first do X then Y" outside § Implementation order. Signatures, table columns, JSON shapes and error codes are contract, not implementation, and belong here.
3. **No discretion left to the agent.** Every choice the implementer would otherwise make (a limit, a default, a status code, an ordering, an error message, a library) is either decided in the spec or listed as an open `Q` in the index and resolved with the operator before the spec is approved. Banned phrasing: "appropriate", "as needed", "reasonable", "etc.", "and so on", "should handle errors", "TBD".
4. **Not one perspective.** Run the review pass (below) before presenting it as done.
5. **Risk-sized.** State the risk tier first; it sets how deep Security and Edge cases must go.
6. **Respect recorded decisions.** See step 1.

## Process

0. **Size and scope gate.** Pick the tier per `AGENTS.md` § 3 by asking one question: *does this change a contract, a schema, or permissions?* If no, and it is more than a Small fix, it is **Medium**: write the single file from `templates/medium.md` (under ~4 KB, its task list is the plan), run one `Implementer`-lens review, and skip `writing-plans-lite`. If yes, or still ambiguous, it is **Big** (the full flow below). If it is Small, stop: no spec, just a Changes line. If the request spans more than one independent subsystem (separable data, API and UI that could ship alone), propose splitting into separate specs, one per workstream, and write them one at a time.
1. **Read the constraints.** Read `workflow/project-state/STATE.md` and `guardrails.md` in full (and the branch state), then only the cold files the change touches: the affected `architecture/<area>.md`, the matching `conventions/<topic>.md`, and any `decisions/C<n>.md` cited from what you read. Anything the request collides with is handled by `AGENTS.md` § 4: stop, name the entry, ask **keep** or **reverse**. Seed the spec's non-goals from those entries and cite them by ID.
2. **Ground it in the code.** Read the code the change touches (service, repository, schema, UI entry points). Specify against what exists; name real classes, tables and migrations. Never reconstruct project history from source (`AGENTS.md` § 1).
3. **Clarify, one question at a time**, only about things the code and state files cannot answer: purpose, who is affected, acceptance, risk. Prefer multiple choice. Stop asking once every `Q` is closed.
4. **Settle the risk tier** (see Risk tiers) with the operator in one sentence.
5. **Choose the approach.** If more than one design is viable (different data shape, layer placement, or build-vs-reuse), give 2-3 options with trade-offs and a recommendation; the operator picks. Record the pick and the rejected options in the index's § Decisions made in this spec. If only one is viable, say so and move on.
6. **Write the files** (see Layout and Components). Present the index and each component to the operator in turn; fix as they react.
7. **Review pass** (run the lint script first, below) by dedicated read-only `lite-reviewer` subagents (see Perspectives). Fix findings in the files, not in chat.
8. **Run the lint script**, then self-check against the checklist at the bottom:

```bash
node .claude/skills/writing-specs-lite/scripts/lint.mjs spec workflow/specs/YYYY-MM-DD-<topic>-design.md
```

Fix every error it prints before asking for approval (add `--approved` once the operator approves, to enforce 'no open Q'). Do this before the review pass so reviewers spend effort on judgement.
9. **Ask the operator to approve** (`AGENTS.md` § 8, gate 1). Stop and ask one question naming the index path, risk tier, lenses run, decisions and rejected options; start no plan on silence or a partial yes. On a yes, write `Status: Approved (<operator name>, <date>)` in the index, run `lint.mjs spec <index> --approved`, record it (Recording) and start `writing-plans-lite`. On changes, fix the files and ask again.

## Layout

Spec location follows `AGENTS.md` § 3; the folder holds the components:

```
workflow/specs/YYYY-MM-DD-<topic>-design.md      <- index (always)
workflow/specs/YYYY-MM-DD-<topic>-design/
    requirements.md      <- only when functional + non-functional requirements exceed 6
    data-model.md        <- when data or state changes
    api.md               <- when any interface (service method, endpoint, event, CLI) is added or changed
    ui.md                <- when screens or flows change: each screen/state (empty, loading, error, populated), controls, copy, navigation, role visibility
    conventions.md       <- when the change sets or applies naming/layout/error/format rules
    edge-cases.md        <- always
    implementation-order.md  <- always
```

Omit a file only if it truly has nothing to say, and say so in the index ("No API changes: <why>"). Never create an empty file.

## The index (`...-design.md`)

Short. It must stand alone as the summary a reviewer reads first.

```markdown
# <Topic> Design

- **Status:** Draft | In review | Approved (operator name, date)
- **Risk tier:** Low | Medium | High - <one sentence why>
- **Workstream:** <ID> | **Plan:** <link once written>
- **Constraints consulted:** <guardrails.md / decision / convention entries cited by ID>

## 1. Problem
<What is wrong or missing, who is affected, evidence. 1-2 paragraphs. For a change to existing behaviour, state the **current behaviour** (verified in code, with the class/table) and the **desired behaviour** side by side.>

## 2. Goals
Ordered logically (a requirement that others depend on comes first). Each is testable.
**Functional**
- F1 ...
**Non-functional** (performance, security, reliability, usability, maintainability; with numbers)
- N1 ...
(Count functional and non-functional together; if there are more than 6 in total, move this section to `requirements.md` and keep only a one-line summary and link here.)

## 3. Non-goals
- <thing deliberately not done> - <why; cite decision or guardrails ID if recorded>

## 4. Components
Links to each file in the design folder with a one-line summary, or "none: <why>".

## 5. Open questions
| ID | Question | Blocks | Owner |
Must be empty before status is Approved.

## 6. Decisions made in this spec
| ID | Decision | Why / rejected alternative | Asked by |
```

Spec-local IDs use provisional form (`F1`, `N1`, `Q1`, `SD1`); they are not permanent project IDs and must not be cited outside the spec folder and its branch state.

## Components

Start each file from `templates/` in this skill folder (`index.md`, `requirements.md`, `data-model.md`, `api.md`, `ui.md`, `conventions.md`, `edge-cases.md`, `implementation-order.md`) so the columns and headings stay uniform across specs.

**requirements.md** - the F/N lists from the index, each with an acceptance criterion ("Given/When/Then" or a measurable threshold). Order so dependencies come first.

**data-model.md** - *logical* model, not DDL: entities, attributes with type/nullability/default/range, keys, relationships and cardinality, ownership, lifecycle/state machine (states, legal transitions, who may trigger each), invariants ("sum of X equals Y"), retention, migration/backfill impact on existing rows, and which `architecture/<area>.md` files change. For persisted data also give **migration and rollback**: the migration version it needs, how existing rows are transformed, whether committed schema, seed or reference data must be regenerated (see `STATE.md` §1 Orientation), and what happens if the migration fails halfway. A small ER or state diagram (Mermaid) is welcome when it removes prose.

**api.md** - for each operation: name/signature, caller and required role, inputs with validation rules and limits, outputs, errors (condition -> error type/message), idempotency, transaction boundary, events emitted, and compatibility with existing callers. Include **security** per operation: authorization rule, what must never be logged or returned, input trust. Table form preferred.

**conventions.md** - the rules this change follows or introduces: naming, package/layer placement (check against the architecture tests named in `conventions/`), error handling and message style, money/date/time formats, audit-row requirements, test conventions. Cite existing `conventions/` entries rather than restating; list only new or applied-here rules.

**edge-cases.md** - table, grouped by theme (input, state, concurrency, failure, permission, time/clock, data volume, migration). Columns: *ID* (`E1`, `E2`, ... unique, never reused or renumbered; the plan and tests cite them), *Requirement* (F/N IDs it covers), *Scenario*, *Expected behaviour (exact)*, *Why it matters*, *Test layer* (unit / service / integration / UI). Every F requirement and every API error appears in at least one row's *Requirement* column (the lint script checks F/N coverage). Scale to risk tier.

**implementation-order.md** - the logical sequence of tasks that the plan will mirror. Each task: ID (`T1`...), one-line outcome, what it delivers that others rely on, requirements it satisfies. Then the dependency table:

| Task | Depends on | Can run concurrently with | Wave |
|---|---|---|---|
| T1 Schema + migration | - | T3 | 1 |
| T2 Repository | T1 | - | 2 |
| T3 Domain policy | - | T1 | 1 |

The first column starts with the task ID (`T1`). Dependencies and concurrency use IDs only. A task's wave is one more than its latest dependency's wave; concurrency is symmetric (the lint script checks all three).

Rules: a task depends on another only if it needs its *output or interface*; tasks in the same wave share no files; mark the wave a task can start in, and note shared-file hazards ("T4 and T5 both edit `AppContext`: serialize"). No step-level instructions here.

## Risk tiers

Decide from the change, not the feature name. Record the tier and why in the index.

| Tier | Triggers | Depth required |
|---|---|---|
| Low | Cosmetic/UI-only, no data, no money, no permissions | Edge cases: input + state basics. Security: one line stating nothing changes |
| Medium | New or changed data, state transitions, new service API, new dependency | Full api.md security per operation; edge cases across all themes; migration notes |
| High | Money/ledger/escrow, role or permission rules, account governance, data migrations touching existing rows, anything irreversible | Everything in Medium plus: threat list (who could abuse this, how), failure/rollback behaviour for every multi-step mutation, audit trail requirements, a concurrency analysis, and an explicit "what could corrupt data" section in edge-cases.md |

**Project invariants.** Read them from the project state (`architecture/`, `conventions/`, `guardrails.md`) every time; never from memory, because they change between iterations. For a multi-user networked system (the web pivot) the floor is **Medium**, and **High** for anything touching authentication, authorization, tenancy, money or personal data. Every operation in `api.md` must then state: the authenticated principal, the authorization rule and where it is enforced, the tenancy scope (whose data it may read or write, and how cross-tenant access is prevented), input validation limits, and what is logged. Any invariant the project state records for money, audit or transactions is restated per operation as a checkable rule.

## Perspectives (review pass)

A spec written from one point of view hides that point of view's blind spots. Before asking for approval, review the drafted files from the lenses the tier calls for (see Scale by tier). Dispatch one fresh `lite-reviewer` subagent per lens (`.claude/agents/lite-reviewer.md`; tools are Read, Grep, Glob only, so it cannot edit). Give each the index path, the lens and the risk tier; run them in parallel. Each reviews **logic first, then seams and integration with the wider system**, then its lens. Do not review your own spec inline instead; if the agent cannot be dispatched, tell the operator and stop rather than self-reviewing.

| Lens | Asks |
|---|---|
| **Implementer** | Could I build this with zero questions? Any unstated default, ambiguous term, missing error, contradiction between files? |
| **Tester / QA** | Is every requirement observable and testable? Which edge case is missing? Which expected behaviour is not exact? |
| **Attacker / abuser** | Who can call this with the wrong role, bad input, or in the wrong state? What can be replayed, raced or forged? |
| **Maintainer / future reader** | Does it respect Architecture and Conventions? Does it quietly reverse a Known Gap or decision? What will surprise someone in six months? |
| **User / operator** | Does it solve the stated problem? Is anything in scope the operator did not ask for? |

**Scale by tier.** Low and Medium: Implementer + Tester. High: Implementer + Tester + Maintainer. The User lens is dispatched only when the operator asks for it. The W-INFRA trial showed four parallel lenses overlap heavily, hence the caps.

**Add the Attacker lens dynamically, at any tier, when the feature needs extra protection.** Add it when the spec touches any of: authentication or session handling; roles, permissions or ownership checks; tenancy or one user reading another's data; money, ledger or escrow; personal or sensitive data; secrets, tokens or API keys; untrusted input crossing a boundary (public endpoints, file uploads, user text sent to an LLM, webhooks); or anything that is hard to undo if abused. The spec author decides while drafting and states it in the index's review line ("Lenses: Implementer, Tester, Maintainer, Attacker (reason)"); any other reviewer who finds such a surface recommends adding it, and the author dispatches it in the next round. When the Attacker lens runs it writes the threat list (actor, abuse, mitigation present or missing), kept in `api.md` security rows or `edge-cases.md`, and every row needs a test. When it does not run, the spec's Security line says nothing in the list above applies.

**Review bundle.** Build the shared context once per round (`ws pack reviewer --area <A> --cat > .ws/review-bundle.md`, or by hand: `guardrails.md` entries touching the target, the affected `architecture/<area>.md` Now, applicable convention topics, the out-of-scope list; about 3-5 KB). Give every lens the same bundle. Reviewers do **not** open `STATE.md` or other state files; this saves one full state read per lens per round.

**Reviewer prompt:** "Review the spec at `<index path>` and its folder. Lens: <lens>. Risk tier: <tier>. Context bundle: `<bundle path>` (do not read other state files)." The output format and review order live in the agent definition; merge the reports and deduplicate before triage.

**Change control after approval.** Do not edit an Approved spec silently. Amend it, record it in the branch state as a Decision (`C~n`: what changed, why, who asked, what was rejected) and put a one-line pointer to it at the top of the index (`Amended YYYY-MM-DD: see branch state C~n`), re-run the lenses that the change touches, and tell the operator; if a plan exists, update the plan before coding continues.

**Round cap.** At most two review rounds. After round two, any unresolved blocking finding becomes an open `Q` for the operator; do not loop.

Triage findings: fix blocking ones in the files; turn judgement calls into `Q`s for the operator; record rejected findings with a reason under § Decisions made in this spec. Note in the index which lenses ran.

## Recording (AGENTS.md § 2-3)

On the feature branch, in the same commit as the spec or the next:
- Add/update the workstream row in the **branch state** (`Spec'd`, spec link, Guide `-`), and a Changes line.
- Record the operator's scoping decisions and rejected options as provisional decisions (`C~n`) with who asked and why.
- A new accepted limitation goes in the branch state's Known Gaps section; a new durable rule goes in its Conventions section (provisional IDs, folded later). Never edit `STATE.md` or other project-state files on a branch.
- Commit the spec folder on its own (`docs: spec for <topic>`), separate from code.

## Self-check before handoff

- [ ] Risk tier stated; depth matches it.
- [ ] Every `guardrails.md` entry and decision relevant to the topic is cited, and none is contradicted (or the operator chose "reverse" and it is recorded).
- [ ] Goals are ordered, testable, and each has an acceptance criterion; >6 moved to `requirements.md`.
- [ ] Non-goals listed.
- [ ] No implementation detail outside `implementation-order.md`; no code bodies.
- [ ] Banned vague words absent; no open `Q`.
- [ ] Every API error and every F requirement has an edge-case row with an ID.
- [ ] `lint.mjs spec` passes with no errors.
- [ ] Dependency table present; waves have no shared files.
- [ ] Review pass ran; lenses noted; findings resolved or recorded.
- [ ] Files are separate and each is short.
- [ ] Current vs desired behaviour stated for any change to existing behaviour; chosen approach and rejected options recorded.
- [ ] Persisted-data changes include migration, rollback and mock-DB rebuild notes.
