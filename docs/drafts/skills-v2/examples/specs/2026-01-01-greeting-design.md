# Greeting Design

- **Status:** Approved (Example Operator, 2026-01-01)
- **Format:** v2
- **Risk tier:** Low - read-only endpoint, no data or permissions
- **Workstream:** W-EX | **Plan:** ../plan/plan.md
- **Constraints consulted:** none

## 1. Problem
The service has no way to greet a user by name. Desired: GET /greet returns a greeting.

## 2. Goals
**Functional**
- F1 GET /greet?name=X returns 200 with "Hello, X" - Accept: given name=Ada, body is "Hello, Ada"

**Non-functional**
- N1 Responds in under 50 ms at p95 - Accept: measured by the endpoint test

## 3. Non-goals
- Localisation - not needed for the demo

## 4. Design
### 4.1 Approach
A pure function builds the text; a route calls it.
### 4.2 Data model
None: nothing is stored.
### 4.3 Interfaces
| Operation | Caller / role | Inputs | Outputs | Errors | Notes |
|---|---|---|---|---|---|
| GET /greet | anyone | name: 1-40 chars | 200 text | 400 "name required" when empty | idempotent |
### 4.4 UI
None: no screens.
### 4.5 Conventions
None.
### 4.6 Sequencing constraints
None.

## 5. Edge cases
| ID | Req | Scenario | Expected behaviour (exact) | Test layer |
|---|---|---|---|---|
| E1 | F1 | name is empty | 400 with body "name required" | unit |
| E2 | F1 | name is 41 characters | 400 with body "name too long" | unit |

## 6. Security
Low: nothing in the authentication, data or input-trust list changes beyond a length-limited string.

## 7. Open questions
| ID | Question | Blocks | Owner |
|---|---|---|---|

## 8. Decisions made in this spec
| ID | Decision | Why / rejected alternative | Asked by |
|---|---|---|---|
| SD1 | Plain text body | JSON rejected: no other fields | operator |

## 9. Review record
Lenses: Implementer, Tester | Rounds: 1 | Rejected findings: none.
