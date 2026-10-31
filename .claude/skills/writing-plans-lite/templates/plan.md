# <Topic> Implementation Plan

- **Status:** Draft | In review | Approved (operator name, date)

> **For agents:** tick `- [ ]` -> `- [x]` as you finish each step, in this file, in the same commit as the work. Keep the branch state's Progress cell current. Spec: [<topic> design](../specs/YYYY-MM-DD-<topic>-design.md).

## Scope
**Goal:** <one sentence>
**In scope:** <F/N IDs>
**Non-goals:** <from spec>
**Risk tier:** <tier>

## Task order
<!-- Status: Not started / In progress / Done / Blocked / Post-merge (a human step after the merge) -->
| Task | Depends on | Can run concurrently with | Wave | Status |
|---|---|---|---|---|
| T1 <name> | - | - | 1 | Not started |

## Traceability
| Requirement | Task(s) | Verified by |
|---|---|---|
| F1 | T1 | `<test>` |
| E1 | T1 | `<test>` |

## Verification gates
- Per task: `<TEST>` for the touched area plus the project lint check.
- Before finishing: `<BUILD>` green; every F/N has a passing test or recorded manual check.

---

### T1: <name>
**Delivers:** <outcome> | **Satisfies:** F1 | **Depends on:** - | **Wave:** 1

**Files**
| Action | Path | What changes |
|---|---|---|
| Create | `path/to/new` | <responsibility; spec ref> |
| Modify | `path/to/existing` | <exact change> |
| Test | `path/to/test` | <cases: E IDs> |

**Checklist**
- [ ] 1. Write failing test for <E1>: <asserts>. Run `<TEST> <target>`; expect FAIL because <reason>.
- [ ] 2. Implement <change>.
- [ ] 3. Run the test; expect PASS.
- [ ] 4. `<BUILD>` green.
- [ ] 5. Update branch state: Progress, Changes line.
- [ ] 6. Commit: `feat: <what and why>`.

### Tn: Close-out
- [ ] Every Traceability row verified; `<BUILD>` green.
- [ ] Spec index status and plan Task order reflect reality; amendments recorded in the branch state.
- [ ] Branch state: workstream `In review`, session rows removed, Changes lines complete, new Known Gaps / Conventions / Deviations written, `guide out of date: <what>` noted if affected.
- [ ] Ask the operator to review the branch (`AGENTS.md` § 8, gate 3); write `Approved` only on their yes, and never push, open a PR or merge before it.
