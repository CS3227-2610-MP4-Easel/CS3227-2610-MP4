# Greeting Implementation Plan

- **Status:** Approved (Example Operator, 2026-01-02)
- **Format:** v2
- **Spec:** [greeting design](../specs/2026-01-01-greeting-design.md) | **Spec hash:** 296cb1901196
- **Workstream:** W-EX

## Scope
**Goal:** GET /greet returns a greeting.
**In scope:** F1, N1
**Non-goals:** Localisation.
**Risk tier:** Low - light review only where tagged.

## Shared context
**Commands**
- Build: `npm run build`
- Test: `npm test -- <target>`

**Rules for every task**
- G-1 No secrets in logs.

**Boundaries.** You do not read STATE.md, guardrails.md, the branch state or the spec.

## Task order
| Task | File | Depends on | Concurrent with | Wave | Weight | Review | Status |
|---|---|---|---|---|---|---|---|
| T1 Greeting builder | `tasks/T1.md` | - | - | 1 | trivial | none | Done |
| T2 Route | `tasks/T2.md` | T1 | - | 2 | standard | light | Not started |

## Traceability
| Requirement | Task(s) | Verified by |
|---|---|---|
| F1 | T1, T2 | `greet.test.ts` |
| N1 | T2 | `greet.test.ts` |
| E1 | T2 | `greet.test.ts` |
| E2 | T2 | `greet.test.ts` |

## Close-out
- [ ] lint --closeout clean; build green; review requested.
