# <Topic> Implementation Plan

- **Status:** Draft | In review | Approved (operator name, date)
- **Format:** v2
- **Spec:** [<topic> design](../../specs/YYYY-MM-DD-<topic>-design.md) | **Spec hash:** <12 hex from `lint.mjs hash`>
- **Workstream:** <ID or W~n>

> **For the orchestrator:** this file is your router. Do not open task files yourself except to
> dispatch them; implementers read their own task file and the Shared context below, nothing else.
> You alone write this file's Status column, the branch state and `STATE`-level records.

## Scope
**Goal:** <one sentence, from the spec>
**In scope:** <F/N IDs>
**Non-goals:** <from the spec, including any Known Gap this must not touch, by ID>
**Risk tier:** <tier> - <what that means for review below>

## Shared context
<!-- Max 40 non-empty lines. The orchestrator pastes this into every implementer brief. -->
**Commands**
- Build: `<BUILD per component>`
- Test: `<TEST per component, with a target placeholder>`
- Style/lint: `<lint command>`

**Rules for every task** (ID - rule)
- <guardrails / convention / decision digest that applies to the whole change>

**Boundaries.** You do not read `STATE.md`, `guardrails.md`, the branch state or the spec. You commit
only your own task's files. Contract tests marked read-only are not edited.

## Task order
<!-- Weight: trivial | standard | complex. Review (floor): none | light | full. Status: Not started /
In progress / Done / Blocked / Post-merge. In progress may carry a session: "In progress (s2)". -->
| Task | File | Depends on | Concurrent with | Wave | Weight | Review | Status |
|---|---|---|---|---|---|---|---|
| T1 <name> | `tasks/T1.md` | - | - | 1 | standard | light | Not started |

Bundles: <e.g. "T2+T3 may share one subagent"> or none.

## Traceability
| Requirement | Task(s) | Verified by |
|---|---|---|
| F1 | T1 | `<test class or manual check>` |
| E1 | T1 | `<test name>` |

## Close-out
Run by the orchestrator (no task file):
- [ ] `lint.mjs plan <plan.md> --closeout` has no errors; every Done task has a valid handover.
- [ ] `<BUILD>` green for every component; each F/N has a passing test or a recorded manual check.
- [ ] Code review of the branch diff (`code-review` skill); confirmed findings fixed or recorded as Deviations.
- [ ] Branch state: workstream `In review`, session rows removed, Changes lines, new Known Gaps /
      Conventions / Deviations, `Post-merge` tasks written as Handover items, `guide out of date: <what>`.
- [ ] Ask the operator to review the branch (`AGENTS.md` § 8, gate 3); `Approved` only on their yes;
      never push, open a PR or merge before it.
