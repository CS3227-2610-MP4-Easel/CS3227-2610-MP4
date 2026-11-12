# W11 Security Corpus and Authorisation Tests Implementation Plan

- **Status:** Approved (operator, 2026-11-09)
- **Format:** v2
- **Spec:** [W11 design](../../specs/2026-11-09-w11-security-corpus-authorisation-tests-design.md) | **Spec hash:** 02f699ca789b
- **Workstream:** W11

## Scope
**Goal:** Add deterministic security-corpus evidence and policy-derived authorization coverage without changing production contracts.
**In scope:** F1-F7, N1-N4, E1-E23.
**Non-goals:** Live SoCLaaS, production schema/policy/guard changes, deployment/process-settings changes (AD-26, AD-32).
**Risk tier:** High - tests cover roles, tenancy, secrets, untrusted input and process escape paths; all tasks receive full review with Attacker lens.

## Shared context
**Commands**
- Test corpus: `node --import tsx --import ./tests/security/w11-network-deny.setup.ts --test tests/security/attack-corpus.test.ts`
- Test API security: `node --import tsx --test src/be/api/test/authorization-generated.test.ts src/be/api/test/authorization-source-rules.test.ts`
- Test process safety: `node --import tsx --test tests/process-security/w11-runner-safety.test.ts`
- Lint/typecheck: `npm run lint`

**Rules for every task** (IDs - rule)
- AD-25 - untrusted text uses existing guard pipeline; output is plain text.
- AD-26 - four evidence layers; CI never calls SoCLaaS; corpus cases have machine-checkable criteria and independent review.
- AD-32 - W12 owns process-policy/review enforcement; W11 owns corpus and authorization-test content.
- AD-55 - policy map is the authorization source; handlers do not perform role authorization.
- AD-72 - Dev Lead owns W11.
- W12 protects `tests/security/attack-corpus/**`; fixture strings are inert data.
- Synthetic data only; never print fixture text, tokens, codes, secrets or prompts.

**Boundaries.** Implementers read only their task file plus this context. They do not read project state,
guardrails or the spec. Each task commits only its files and writes its handover.

## Task order
| Task | File | Depends on | Concurrent with | Wave | Weight | Review | Status |
|---|---|---|---|---|---|---|---|
| T1 Corpus schema and manifest | `tasks/T1.md` | - | T3 | 1 | complex | full | done |
| T2 Deterministic corpus runner and process safety | `tasks/T2.md` | T1 | - | 2 | complex | full | done |
| T3 Policy-derived authorization and source rules | `tasks/T3.md` | - | T1 | 1 | complex | full | done |

Bundles: none. T1 and T3 share no files. T2 consumes T1's manifest/schema contract.

## Traceability
| Requirement | Task(s) | Verified by |
|---|---|---|
| F1 | T1 | manifest schema validation |
| F2 | T2 | guard/output corpus assertions |
| F3 | T2 | context/suggestion corpus assertions |
| F4 | T2 | auth/limiter/session assertions |
| F5 | T3 | policy-derived row completeness |
| F6 | T3 | authorization/source-rule assertions |
| F7 | T2 | process-safety and inert-data assertions |
| N1 | T2 | deny-all tripwire and deterministic runner |
| N2 | T1 | stable case IDs and threat mapping |
| N3 | T3 | independent review/protected-path evidence |
| N4 | T2 | three timing runs and hard timeout |
| E1 | T1 | manifest validator |
| E2 | T2 | input corpus |
| E3 | T2 | URL output corpus |
| E4 | T2 | HTML output corpus |
| E5 | T2 | Markdown output corpus |
| E6 | T2 | secret/boundary corpus |
| E7 | T2 | refusal corpus |
| E8 | T2 | context corpus |
| E9 | T2 | suggestion corpus |
| E10 | T3 | cross-project authorization |
| E11 | T2 | invalid-code auth |
| E12 | T2 | rate-limit auth |
| E13 | T2 | registration replay |
| E14 | T2 | limiter barrier |
| E15 | T2 | session barrier |
| E16 | T3 | NONE policy rows |
| E17 | T3 | predicate rows |
| E18 | T3 | authorization ordering |
| E19 | T3 | archived precedence |
| E20 | T3 | source rule |
| E21 | T2 | process-safety runner |
| E22 | T2 | timeout/network tripwire |
| E23 | T3 | review-control evidence |

## Close-out
- [ ] `lint.mjs plan <plan.md> --closeout` passes and every task has a handover.
- [ ] `npm run lint` and all focused suites pass.
- [ ] Branch diff receives code review with Implementer, Tester and Attacker lenses.
- [ ] Branch state becomes `In review`; session rows and Changes are reconciled.
- [ ] Ask the operator for Gate 3 branch review before any merge or push.
