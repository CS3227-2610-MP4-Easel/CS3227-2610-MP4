---
name: writing-specs-lite-v2
description: Use when a feature-level change needs a design spec before any plan or code (AGENTS.md § 3 "Big"), or when the operator says write/draft a spec. Produces ONE spec file (problem, goals with IDs, non-goals, design contracts, edge cases, security, decisions), reviewed from several lenses and sized to risk. The plan, not the spec, is split into per-task files. Default since v2; v1 (writing-specs-lite) is retained for audit only.
---

# Writing Specs (lite, v2)

A spec says **what the system must be and how it must behave**, never **how to build it step by
step**. One file, one reader journey: the operator approves it, then `writing-plans-lite-v2` turns
it into self-contained task files and the spec is not read again during implementation.

**Announce at start:** "I'm using writing-specs-lite-v2 to write the spec."

**What changed from v1.** v1 split the spec into an index plus component files so agents could read
only the relevant part. Implementers read the plan, not the spec, so that split cost the operator
review effort and bought nothing. v2 keeps a single file, keeps every ID (`F`, `N`, `E`, `Q`, `SD`)
and drops `implementation-order.md`: task boundaries and the dependency table are the plan's job.

## Hard rules

1. **One file.** `workflow/specs/YYYY-MM-DD-<topic>-design.md`, no companion folder. Target 150-300
   lines; lint errors above 500 (a spec that long is probably two workstreams: propose the split).
2. **No implementation detail.** No code bodies, step lists or task breakdown. Signatures, table
   columns, JSON shapes, state machines and error codes are contract and belong here.
3. **No discretion left to the agent.** Every choice an implementer would otherwise guess (limit,
   default, status code, ordering, message, library) is decided here or is an open `Q` resolved
   with the operator before approval. Banned phrasing: "appropriate", "as needed", "reasonable",
   "etc.", "and so on", "should handle errors", "TBD".
4. **Not one perspective.** Run the review pass before presenting it as done.
5. **Risk-sized.** State the tier first; it sets how deep Security and Edge cases go.
6. **Respect recorded decisions** (step 1).
7. **Write for the planner.** Contracts must be copy-ready: the planner pastes the relevant ones
   into task files, so a contract that only makes sense next to three others is a defect.

## Process

0. **Size and scope gate.** Pick the tier per `AGENTS.md` § 3 by asking: *does this change a
   contract, a schema, or permissions?* No, and more than a Small fix: **Medium**, so write
   `templates/medium.md` (under ~4 KB, its task list is the plan), run one Implementer-lens review
   and skip the plan skill. Yes or ambiguous: **Big**, the flow below. Small: stop, no spec, a Changes
   line. If the request spans independent subsystems that could ship alone, propose one spec per
   workstream and write them one at a time.
1. **Read the constraints.** `STATE.md`, `guardrails.md` and the branch state in full, then only the
   cold files the change touches (`architecture/<area>.md`, `conventions/<topic>.md`, cited
   `decisions/C<n>.md`). A collision is handled by `AGENTS.md` § 4: stop, name the entry, ask
   keep or reverse. Seed the non-goals from those entries and cite them by ID.
2. **Ground it in the code.** Read what the change touches; name real classes, tables, migrations.
3. **Clarify, one question at a time**, only about what code and state cannot answer: purpose, who is
   affected, acceptance, risk. Prefer multiple choice. Stop when every `Q` is closed.
4. **Settle the risk tier** with the operator in one sentence.
5. **Choose the approach.** If more than one design is viable, give 2-3 options with trade-offs and a
   recommendation; the operator picks. Record the pick and rejected options in § 8.
6. **Write the file** from `templates/spec.md`. Present it section by section; fix as they react.
7. **Lint**: `node .claude/skills/writing-specs-lite-v2/scripts/lint.mjs spec <spec.md>`. Fix every
   error first so reviewers spend effort on judgement.
8. **Review pass** (Perspectives below). Fix findings in the file, not in chat.
9. **Ask the operator to approve** (`AGENTS.md` § 8, gate 1). One question naming the spec path, risk
   tier, lenses run, decisions and rejected options. On a yes write `Status: Approved (<name>,
   <date>)`, run `lint.mjs spec <spec.md> --approved`, record it (Recording) and start
   `writing-plans-lite-v2`. On changes, fix and ask again. Silence or a partial yes starts nothing.

## What the spec contains (and does not)

| § | Section | Contains | Does not contain |
|---|---|---|---|
| header | Status, Format, Risk tier, Workstream, Plan, Constraints consulted | cited guardrail/decision/convention IDs | prose |
| 1 | Problem | current behaviour (verified in code, class/table named) next to desired behaviour; who is affected | history of how we got here |
| 2 | Goals | `F` functional and `N` non-functional (with numbers), ordered so dependencies come first, each with an acceptance criterion | solutions |
| 3 | Non-goals | what is deliberately not done, why, ID if recorded | wish lists |
| 4 | Design | 4.1 Approach (chosen, why); 4.2 Data model; 4.3 Interfaces; 4.4 UI; 4.5 Conventions; 4.6 Sequencing constraints | code bodies, step lists, task splits |
| 5 | Edge cases | `E` table, grouped by theme | restated requirements |
| 6 | Security | tier-scaled; per-operation principal/authz/tenancy/validation/logging | generic advice |
| 7 | Open questions | `Q` table, empty at approval | decisions disguised as questions |
| 8 | Decisions made here | `SD` table: decision, why / rejected, asked by | |
| 9 | Review record | lenses run, round count, rejected findings with reason | |

Subsections 4.2-4.5 appear only when the change touches them; otherwise one line `None: <why>`.

**4.2 Data model** is logical, not DDL: entities, attributes with type/nullability/default/range, keys,
relationships, ownership, state machine (states, legal transitions, who triggers each), invariants,
retention. Persisted data also needs **migration and rollback**: version, how existing rows change,
whether committed schema/seed data must be regenerated, what happens if the migration fails halfway.

**4.3 Interfaces** per operation: signature, caller and role, inputs with validation and limits,
outputs, errors (condition to type/message), idempotency, transaction boundary, events emitted,
compatibility with existing callers. Table form.

**4.4 UI**: each screen state (empty, loading, error, populated), controls, copy, navigation, role
visibility.

**4.5 Conventions**: only new or applied-here rules; cite `conventions/` entries instead of restating.

**4.6 Sequencing constraints**: hard ordering facts the planner must respect ("migration before
repository", "files X is edited by both A and B"). Facts only; no task list.

**5 Edge cases**: columns *ID* (`E1`..., unique, never renumbered), *Req* (F/N IDs covered),
*Scenario*, *Expected behaviour (exact)*, *Test layer*. Every F requirement and every interface error
has a row. High tier adds a "What could corrupt data" group.

## Risk tiers

| Tier | Triggers | Depth required |
|---|---|---|
| Low | Cosmetic/UI-only, no data, no money, no permissions | Edge cases: input + state basics. Security: one line stating nothing changes |
| Medium | New or changed data, state transitions, new service API, new dependency | Per-operation security; edge cases across all themes; migration notes |
| High | Money/ledger, role or permission rules, account governance, migrations touching existing rows, anything irreversible | Medium plus threat list (actor, abuse, mitigation), rollback for every multi-step mutation, audit trail, concurrency analysis, "What could corrupt data" |

Decide from the change, not the feature name. Read the project invariants from `architecture/`,
`conventions/` and `guardrails.md` each time. For a multi-user networked system the floor is
**Medium**, **High** for authentication, authorization, tenancy, money or personal data; each
operation then states principal, authorization rule and where enforced, tenancy scope, validation
limits and what is logged.

## Perspectives (review pass)

Dispatch one fresh read-only `reviewer` subagent per lens, in parallel (tools Read/Grep/Glob only; if it
cannot be dispatched, tell the operator and stop rather than self-review). Each reviews logic first,
then seams with the wider system, then its lens.

| Lens | Asks |
|---|---|
| **Implementer** | Could I build this with zero questions? Unstated default, ambiguous term, contradiction? Can each contract be copied into a task as is? |
| **Tester / QA** | Is every requirement observable? Which edge case is missing or not exact? |
| **Attacker / abuser** | Who can call this with the wrong role, bad input, wrong state? What can be replayed, raced, forged? |
| **Maintainer** | Does it respect Architecture and Conventions? Does it reverse a Known Gap or decision? |
| **User / operator** | Does it solve the stated problem; anything in scope nobody asked for? |

**Scale.** Low and Medium: Implementer + Tester. High: add Maintainer. User only on request.
**Add Attacker at any tier** when the spec touches authentication/session, roles or ownership,
tenancy, money, personal data, secrets/tokens, untrusted input crossing a boundary, or anything hard
to undo. State it in § 9 ("Lenses: ..., Attacker (reason)"); the threat list lives in § 6 and every
row needs a test.

**Review bundle.** Build the shared context once (`ws pack reviewer --area <A> --cat >
.ws/review-bundle.md`, or by hand: relevant guardrails, the affected architecture Now, applicable
conventions, out-of-scope list; 3-5 KB). Reviewers do not open `STATE.md`. Prompt: "Review the spec
at `<path>`. Lens: <lens>. Risk tier: <tier>. Context bundle: `<path>` (do not read other state
files)." Merge and deduplicate reports, fix blocking findings, turn judgement calls into `Q`s,
record rejected findings with a reason in § 9. **At most two rounds**; after round two unresolved
blocking findings become open `Q`s.

## Change control after approval

Do not edit an Approved spec silently. Amend it, record a Decision `C~n` in the branch state (what,
why, who asked, what was rejected), add `Amended YYYY-MM-DD: see branch state C~n` under the header,
re-run the touched lenses, tell the operator. If a plan exists, regenerate the affected task files
before coding continues (`lint.mjs plan` warns when the spec hash recorded in the plan is stale).

## Recording (AGENTS.md § 2-3)

In the same commit as the spec or the next: workstream row in the branch state (`Spec'd`, link), a
Changes line, scoping decisions and rejected options as `C~n`, new accepted limitations under Known
Gaps, new durable rules under Conventions. Never edit `STATE.md` on a branch. Commit the spec alone
(`docs: spec for <topic>`).

## Self-check before handoff

- [ ] Tier stated, depth matches; every relevant guardrail/decision cited and none contradicted.
- [ ] Goals ordered, testable, each with an acceptance criterion; non-goals listed.
- [ ] No implementation detail, no task split; banned words absent; no open `Q`.
- [ ] Every F and every interface error has an `E` row; High tier has corruption and threat rows.
- [ ] Persisted-data changes include migration, rollback, seed regeneration notes.
- [ ] Current vs desired stated; chosen approach and rejected options recorded.
- [ ] Contracts are copy-ready for the planner.
- [ ] `lint.mjs spec` passes; review pass ran; lenses noted; findings resolved or recorded.
