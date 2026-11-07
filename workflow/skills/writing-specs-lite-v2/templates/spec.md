# <Topic> Design

- **Status:** Draft | In review | Approved (operator name, date)
- **Format:** v2
- **Risk tier:** Low | Medium | High - <one sentence why>
- **Workstream:** <ID or W~n> | **Plan:** <link once written>
- **Constraints consulted:** <guardrails.md / decision / convention IDs>

## 1. Problem
<Current behaviour (verified in code: class/table) and desired behaviour, side by side. Who is
affected. 1-2 paragraphs.>

## 2. Goals
Ordered so dependencies come first. Each is testable and carries its acceptance criterion.

**Functional**
- F1 <goal> - Accept: <Given/When/Then or measurable threshold>

**Non-functional** (performance, security, reliability, usability; with numbers)
- N1 <goal> - Accept: <threshold>

## 3. Non-goals
- <thing deliberately not done> - <why; decision/guardrails ID if recorded>

## 4. Design
### 4.1 Approach
<Chosen approach in 3-8 lines. Rejected options are in § 8.>

### 4.2 Data model
<Logical model, state machine, invariants, migration and rollback; or "None: <why>".>

### 4.3 Interfaces
| Operation | Caller / role | Inputs (validation, limits) | Outputs | Errors (condition -> type/message) | Notes (idempotency, transaction, events) |
|---|---|---|---|---|---|

### 4.4 UI
<Screen states, controls, copy, navigation, role visibility; or "None: <why>".>

### 4.5 Conventions
<Only new or applied-here rules; cite conventions/ IDs; or "None: <why>".>

### 4.6 Sequencing constraints
<Hard ordering facts and shared-file hazards the planner must respect; or "None".>

## 5. Edge cases
| ID | Req | Scenario | Expected behaviour (exact) | Test layer |
|---|---|---|---|---|
| E1 | F1 | | | unit |

## 6. Security
<Low: one line stating nothing changes. Medium: per operation principal, authorization rule and where
enforced, tenancy scope, validation limits, logging. High: add threat list (actor, abuse,
mitigation present or missing); every row needs an E-row test.>

## 7. Open questions
| ID | Question | Blocks | Owner |
|---|---|---|---|

## 8. Decisions made in this spec
| ID | Decision | Why / rejected alternative | Asked by |
|---|---|---|---|
| SD1 | | | |

## 9. Review record
Lenses: <Implementer, Tester, ...> | Rounds: <n> | Rejected findings: <finding - reason> or "none".
