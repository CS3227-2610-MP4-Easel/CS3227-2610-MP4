# W11 Security Corpus and Authorisation Tests Design

- **Status:** Approved (operator, 2026-11-09); amended (operator, 2026-11-09)
- **Format:** v2
- **Risk tier:** High - the work verifies role, tenancy, secret and untrusted-input boundaries.
- **Workstream:** W11 | **Plan:** —
- **Constraints consulted:** `AD-25`, `AD-26`, `AD-32`, `AD-55`, `AD-57`, `AD-72`, C8; `guardrails.md`; W1 authorization contracts; W3 guard conventions; W12 process-security policy.

## 1. Problem

The repository has pure guard tests in `src/be/llm-gateway/test/guards.test.ts`, gateway behavior
tests, and policy/middleware tests in `src/be/api/test/authorization-matrix.test.ts` and
`authorization-project-scope.test.ts`. These tests are spread across the owners that created the
controls. There is no reviewable corpus whose cases state the threat, fixture, and machine-checkable
success criterion, and no W11 suite that proves every policy-map entry is exercised for role and
resource-scope outcomes.

W11 adds an owner-independent security evidence layer. Guard and gateway tests continue to prove
their local contracts; the corpus proves that representative attacks fail closed or are redacted;
the authorization suite derives cases from the canonical policy map and proves that hidden,
cross-project, wrong-role, membership, self, assignee and adder boundaries produce the existing
contract outcomes. CI remains deterministic and never calls SoCLaaS.

## 2. Goals

**Functional**

- **F1** Define a versioned, reviewable corpus case format with threat ID, attack input, affected boundary, expected result, and machine-checkable success criterion. Accept: every case is
  schema-valid, has one of T1-T11, and names a concrete assertion rather than a prose expectation.
- **F2** Cover the untrusted-text controls for T1, T2, T3, T5, T6, T9 and T11. Accept: corpus
  execution proves canaries and secrets are not exposed, forbidden links/HTML/Markdown are rejected,
  and personal-data fixtures are redacted or rejected according to the existing guard contract.
- **F3** Cover cross-project context and object isolation for T4. Accept: the real context seam
  rejects a forbidden project or object, and a cross-project resource request returns `404 NOT_FOUND`.
- **F4** Cover budget and registration-code abuse boundaries for T7 and T8 without contacting an external service. Accept: deterministic tests prove invalid codes return `403 REGISTRATION_CODE_INVALID`, repeated invalid attempts return `429 RATE_LIMITED`, and limiter/session caps return the exact existing `429 AI_BUSY` or `429 RATE_LIMITED` contract without logging secrets.
- **F5** Generate authorization cases from `getPolicyMap()` rather than duplicating the policy table. Accept: every policy entry has a test row, every declared role is exercised, and every
  non-`NONE` predicate has a resource fixture and expected denial path.
- **F6** Preserve the policy-map-only authorization rule. Accept: generated tests observe that
  handlers are not invoked after authentication, role, membership, resource, or predicate denial;
  a source-rule test rejects direct role/policy authorization in route handlers while allowing the
  handler to pass the authorized identity to its domain service.
- **F7** Make corpus data safe for agent and CI handling. Accept: corpus content is treated as
  data, lives under the protected path used by W12, and is never interpolated as executable
  instructions or written outside its declared fixture boundary.

**Non-functional**

- **N1** Determinism. Accept: corpus and generated authorization tests use fixed fixtures,
  mocked gateway/model boundaries, install a deny-all network tripwire for fetch, HTTP/HTTPS,
  sockets and DNS, and repeated runs produce the same assertions.
- **N2** Traceability. Accept: each corpus case maps to one threat and one or more `F`/`E` IDs;
  each generated authorization row names its policy key and operation ID in a failure message.
- **N3** Review separation. Accept: W11 corpus and generated authorization tests are reviewed
  by an owner different from the guard author, as required by `AD-26`.
- **N4** Bounded execution. Accept: the isolated corpus test command completes within 5 seconds
  across three repeated local runs, with a machine-enforced test timeout.

## 3. Non-goals

- Live SoCLaaS calls or model-quality scoring in CI - prohibited by `AD-26`; live evaluation is a
  later manual experiment.
- Changing guard rules, `GUARD_VERSION`, policy-map entries, endpoint contracts, or authorization
  semantics - W11 verifies the frozen contracts owned by W1-W4 and W6.
- Replacing existing unit, gateway, or route tests - W11 adds cross-control evidence and fills
  coverage gaps.
- Production security monitoring, secret rotation, Firebase configuration, or repository settings -
  those belong to W12/W13 and `AD-32`.
- Storing real personal data, credentials, registration codes, or production identifiers - synthetic
  fixtures are required by `AD-25` and T11.

## 4. Design

### 4.1 Approach

The chosen design is a declarative corpus plus deterministic runners. Corpus records are inert data;
each record identifies its threat, input kind, fixture, expected guard/context result, and assertion
parameters. A runner dispatches only to existing pure guards, mock gateway seams, or context/API
fixtures. Authorization coverage is a separate data-driven suite derived at test time from
`getPolicyMap()`, so policy changes cannot silently leave stale copied cases.

Rejected alternatives are recorded in §8: hand-written unrelated tests do not provide drift
detection, and one full-stack harness makes failures opaque and couples corpus data to live setup.

The minimum threat matrix is:

| Threat | Boundary | Minimum evidence | Exact success criterion |
|---|---|---|---|
| T1 | PM input -> guard/model boundary | input corpus | PII redacted by sanitising; injection flagged; remaining non-PII text remains untrusted data |
| T2 | uploaded activity -> summary/standup | input and gateway corpus | injected canary absent from model-facing value; reused text is untrusted |
| T3 | stored task text -> facts/suggestion | context and suggestion corpus | forbidden text/project ID is rejected by the context seam |
| T4 | project-scoped retrieval | context and authorization corpus | forbidden row is rejected; cross-project request is `404 NOT_FOUND` |
| T5 | model output -> renderer | output corpus | URL, HTML and Markdown link/image return `SCHEMA_FAIL` with exact reason |
| T6 | model output -> secret boundary | output and log corpus | key/secret candidate absent from accepted output and captured logs |
| T7 | limiter/session boundary | gateway concurrency corpus | cap is atomic; excess call returns exact `AI_BUSY` or `RATE_LIMITED` |
| T8 | registration-code boundary | auth corpus | invalid code is `REGISTRATION_CODE_INVALID`; repeated invalid attempts hit `RATE_LIMITED` |
| T9 | AI/uploaded text -> browser | output and source/process corpus | unsafe URL output returns `SCHEMA_FAIL` with `LINK`; process/source checks accept only text data |
| T10 | API policy boundary | generated authorization suite | every policy role/predicate allow/deny row has exact status and no handler call on denial |
| T11 | personal data -> external model | input corpus | email/phone/ID-like synthetic values are redacted before the model seam |

The four evidence layers are existing guard unit contracts, existing mocked gateway contracts, the
new declarative corpus runner for guard/gateway/context/output/process boundaries, and the new
policy-derived authorization suite. No layer invokes SoCLaaS.

### 4.2 Data model

No production data model or migration changes. The corpus manifest is a version-1 JSON array. Each
record is exactly:

```json
{
  "id": "T1-input-001",
  "threat": "T1",
  "layer": "INPUT",
  "boundary": "INPUT_GUARD",
  "description": "synthetic prompt injection",
  "fixture": { "kind": "INPUT_TEXT", "text": "...", "maxChars": 2000 },
  "expected": { "criterion": { "type": "REDACTED", "field": "text", "absent": ["CANARY-T1-001"] } }
}
```

Required top-level fields are `id`, `threat` (`T1` through `T11`), `layer` (`INPUT`, `OUTPUT`,
`CONTEXT`, `SUGGESTION`, `AUTH`, or `PROCESS`), `boundary`, `description`, `fixture`, and `expected`;
unknown fields fail validation. Fixture kinds are `INPUT_TEXT` (`text`, `maxChars`), `OUTPUT_TEXT`
(`text`, `maxChars`), `OUTPUT_JSON` (`text`, `schemaName`), `CONTEXT_ROWS`
(`rows`), `SUGGESTION_ROWS` (`rows`), `AUTH_REQUEST`
(`operationId`, `callerProjectId`, `resourceId`, `resourceProjectId`, `authState`, `role`, `code`, `body`), and `PROCESS_TEXT`
(`text`). All text fields are synthetic and bounded to 8,192 Unicode code points; `rows` are bounded
to 100 records. Criterion variants are typed: `REDACTED` requires `field` and `absent`; `ABSENT`
requires `field` and `absent`; `REJECTED` requires `status` and `reason`; `HTTP_ERROR` requires
`status` and `code`; `FLAGGED` requires `field` and boolean `value`; `NO_LOGGED_SECRET` requires
`absent`; `RATE_LIMITED` requires `status`, `code`, and positive integer `retryAfterSeconds`;
`NO_EXECUTION` requires `forbiddenPrimitives` and zero observed calls; `TEXT_ONLY` requires
`field` and `escaped`; `CONTEXT_REJECTED` requires `code`. `rows` have only synthetic `id`, `projectId`, and `text`
fields; `requestBody` is a JSON object with
at most 20 keys, recursive depth at most 8, arrays at most 100 items, keys at most 64 characters,
and serialized size at most 64 KiB; every nested string is at most 8,192 code points and all nested
strings together are at most 64 KiB. `schemaName` is a closed enum of existing output schemas;
`boundary` is a closed enum of the named runner dispatch boundaries. IDs are unique and stable.

Corpus records are immutable test inputs; no runtime writes them and no retention or rollback is
needed. Authorization rows are derived from the current policy map at test time and are not stored.

### 4.3 Interfaces

| Operation | Caller / role | Inputs (validation, limits) | Outputs | Errors (condition -> type/message) | Notes |
|---|---|---|---|---|---|
| Corpus case validation | test runner | version-1 manifest; unique IDs; closed threat/layer/boundary/kind/criterion enums; bounded fixture | validated case list | malformed record -> test failure naming `id` and field | pure; no network; no secrets |
| Corpus execution | test runner | one validated case; closed static dispatch table; existing guard/gateway/context seam | criterion result with case ID | unmet criterion -> assertion failure naming threat, boundary and observed value class | model boundary is mocked; raw fixture text is not included in failure output |
| Authorization coverage derivation | API test suite | `getPolicyMap()`; non-empty 57-entry map; unique policy keys/operation IDs; declared roles and predicates | rows keyed by `(policyKey, operationId, role, predicate, outcome)` | missing, duplicate, zero, or unsupported row -> test failure naming the policy key | derived at test time; no duplicate policy source |
| Authorization case execution | API test suite | synthetic principal, request, resolved resource, membership and dependency fakes | expected status/error and handler/body-parser call counts | mismatch -> assertion failure naming policy key and operation ID | every role gets allow plus wrong-role deny where roles are restricted; every predicate gets allow plus deny |
| Process-safety scan | CI test | runner source files and corpus path | pass/fail | forbidden primitive or protected-path escape -> failure naming file and token | rejects `eval`, `Function`, child-process/shell, dynamic import, network clients and writes outside temp fixtures |

Expected authorization outcomes remain the existing contract: malformed/invalid token `401
UNAUTHENTICATED`; unregistered user `403 USER_NOT_REGISTERED`; wrong role `403 FORBIDDEN_ROLE`;
missing, hidden, or cross-project resource `404 NOT_FOUND`; archived writable resource for a member
`409 CONFLICT_STATE`; limiter/code abuse `429` with the existing stable code.

### 4.4 UI

None: W11 is test and repository evidence; it adds no user-facing screen or navigation.

### 4.5 Conventions

- Dev Lead owns W11 corpus and authorization-test content under `AD-72`; W12 owns only the
  agent-policy/CODEOWNERS controls and review enforcement for those protected files.
- Corpus data is under `tests/security/attack-corpus/`, the protected path in W12; instruction-like
  strings remain inert fixture data.
- Corpus failures identify case ID, threat, layer and criterion, but never print fixture text,
  token-like values, registration codes, or secret candidates.
- The corpus uses only synthetic identifiers and values. Existing guard reason codes are normative;
  W11 does not infer success from a generic thrown error.
- Authorization tests use `getPolicyMap()` as the only policy source and assert handler non-invocation
  on every denial path (`AD-55`).

### 4.6 Sequencing constraints

The planner must create or modify exactly these surfaces: `tests/security/attack-corpus/cases.json`
(manifest), `tests/security/attack-corpus/schema.ts` (validator/types),
`tests/security/attack-corpus/runner.ts` (closed dispatcher),
`tests/security/w11-network-deny.setup.ts` (earliest network/process/filesystem tripwire),
`tests/security/attack-corpus.test.ts` (corpus execution),
`tests/process-security/w11-runner-safety.test.ts` (static process-safety scan),
`src/be/api/test/authorization-generated.test.ts` (policy-derived cases), and
`src/be/api/test/authorization-source-rules.test.ts` (route-handler source rule). Existing package
test discovery and `npm test` must include these files.

The planner must keep corpus data and its runner in the protected security-test surface, and keep
authorization coverage in the API test package where the policy and middleware types are available.
The runner must consume the exported W3 guard contracts after the W3 merge. It must not introduce a
new runtime package, production dependency, schema change, or live-service credential. W12's agent
policy and CODEOWNERS remain authoritative for these files.

Authorization derivation is exact: assert a non-empty map of 57 unique policy keys and operation IDs.
For each policy emit one `AUTH_REQUIRED` row (public policies expect `CONTINUE` without a token;
TOKEN/REGISTERED policies expect `401 UNAUTHENTICATED` without one and `403 USER_NOT_REGISTERED`
for a verified token with no user row). For a restricted policy emit one `ROLE_ALLOW` row per
declared role, one `ROLE_DENY` row using synthetic role `AUDITOR` (disjoint from all application
roles), and one `PREDICATE_ALLOW` plus one `PREDICATE_DENY` row for each non-`NONE` predicate. For
an unrestricted policy, `ROLE_ALLOW` uses synthetic PM and no `ROLE_DENY` row is emitted. `ROLE_ALLOW`
and `PREDICATE_ALLOW` expect `CONTINUE` with the resolved principal/scope; denial rows expect exact
`403 FORBIDDEN_ROLE` or `404 NOT_FOUND`, and archived member writes expect `409 CONFLICT_STATE`.
`NONE` rows use no resource resolver. `MEMBER`, `MEMBER_PROJECTS`, `SELF`, `MEMBER_OR_ASSIGNEE`,
and `ADDER` factories supply caller project, resource ID/project, membership, assignee and target
role. Every denial asserts zero body-parser, predicate-after-failure, and handler calls. The suite
asserts generated row keys cover all 57 policies and every declared role/predicate exactly.

The corpus runner installs and removes a deny-all tripwire around each run before runner imports for
`fetch`, `node:http` request/get, `node:https` request/get, `node:net` connect/createConnection,
`node:tls` connect, `node:dns` lookup/resolve, and `node:dns/promises`; imports needed for pure
helpers such as `node:net` address parsing are allowed, but any network call fails the test.
The process-safety harness also intercepts child-process spawn/exec/fork, and filesystem
write/open/append/mkdir/rename/remove calls, allowing writes only below its temporary fixture
directory. Its dispatch is a literal map from validated `layer`/`boundary` values to imported
functions. Guard cases call the exported W3 guard, context cases call the exported `createAiContext`
seam, and auth cases call the exported registration-code, rate-limit, and registration seams. No
dynamic import, evaluation, subprocess, shell, or repository write is permitted.
The process-safety test AST-scans only runner/process source for those executable primitives and
separately asserts that instruction-like strings are passed as values to the dispatcher, never as
code, paths, commands or imports. The isolated corpus command runs three repeated successful
measurements, each `<= 5,000 ms`, plus a hard 5-second timeout for hangs. The test command loads
`tests/security/w11-network-deny.setup.ts` with `node --import` before `runner.ts`, guard modules,
or fixture modules; import-time and runtime network, process, and protected-path write attempts
both fail the test.

## 5. Edge cases

### What could corrupt data

| ID | Req | Scenario | Expected behaviour (exact) | Test layer |
|---|---|---|---|---|
| E1 | F1,N2 | Duplicate corpus ID or unknown threat | Validation fails naming the duplicate/unknown field and no case executes | unit |
| E2 | F2 | Injection text contains delimiters and PII | Input follows the existing sanitiser contract; PII is absent from the sanitized value and `flagged` is asserted | corpus |
| E3 | F2 | Output contains a URL | `checkOutput` returns `SCHEMA_FAIL` with `LINK`; fixture text is absent from captured logs | corpus |
| E4 | F2 | Output contains HTML or an entity | `checkOutput` returns `SCHEMA_FAIL` with `HTML`; fixture text is absent from captured logs | corpus |
| E5 | F2 | Output contains `](`, `][`, or `![` | `checkOutput` returns `SCHEMA_FAIL` with the frozen `LINK` reason; fixture text is absent from captured logs | corpus |
| E6 | F2 | Output contains a secret pattern or boundary | `checkOutput` returns `SCHEMA_FAIL` with `SECRET` or `BOUNDARY` respectively; raw fixture is not logged | corpus |
| E7 | F2 | Output is exactly `{"refusal":true}` | `checkOutput` returns `REFUSED` with `REFUSAL`; `{}`, `{"refusal":false}`, extra-key and non-boolean refusal near-misses return the schema result | corpus |
| E8 | F3 | Context fixture contains a row from a non-member project | The real context seam rejects with `CONTEXT_SCOPE_VIOLATION`; no forbidden project ID or canary appears in the assembled result | context |
| E9 | F3 | Suggestion fixture contains a forbidden project/object ID | The real context seam rejects with `CONTEXT_SCOPE_VIOLATION`; the forbidden ID and canary are absent from failure output | corpus |
| E10 | F3 | Resource ID belongs to another project | Authorization returns `404 NOT_FOUND` and does not invoke the body parser, predicate, or handler | authorization |
| E11 | F4 | Registration code is wrong | Auth returns exactly `403 REGISTRATION_CODE_INVALID`; the code is absent from captured logs | auth |
| E12 | F4 | Repeated invalid code attempts exceed the fixed window | Auth returns exactly `429 RATE_LIMITED` with a positive integer `Retry-After` header matching `retryAfterSeconds`; the code is absent from captured logs | auth |
| E13 | F4 | A valid registration code is replayed for the same Firebase identity | The second registration returns exactly `409 ALREADY_REGISTERED` and creates no second user row or upstream side effect | auth |
| E14 | F4 | Concurrent limiter reservations exceed the configured cap | A barrier releases `cap + 1` attempts; exactly `cap` reservations succeed with unique keys and every excess call returns exactly `429 AI_BUSY`; release permits one later reservation | gateway |
| E15 | F4 | Concurrent session regenerations exceed the session cap | A barrier releases `cap + 1` attempts; exactly `cap` succeed, every excess call returns exactly `429 RATE_LIMITED`, and no upstream call occurs for excess attempts | gateway |
| E16 | F5,F6 | A policy entry declares `NONE` | The derived row has no resolver/predicate; unauthenticated, unregistered and each declared-role outcome is asserted exactly | authorization |
| E17 | F5,F6 | A policy entry declares a predicate | The derived suite supplies storage-derived data and exactly one allow plus one deny row for that predicate | authorization |
| E18 | F5,F6 | Wrong role or unauthenticated request sends malformed body | Authorization fails first; body parsing, predicate-after-failure and handler invocation are all observed as zero | authorization |
| E19 | F5,F6 | Archived write target is visible to a member | Authorization returns `409 CONFLICT_STATE` before predicate evaluation; a non-member receives `404 NOT_FOUND` | authorization |
| E20 | F6 | Route handler directly compares a role or policy entry | Static source rule fails naming the file and expression; passing identity to a domain service remains allowed | process-security |
| E21 | F7,N1 | Corpus string looks like an instruction, path, URL or shell command | AST scan finds no forbidden primitive; runtime tripwires observe zero network/process/protected-path writes; the string is passed only as a value | process-security |
| E22 | N1,N4 | External endpoint or unavailable mock is requested | The deny-all network tripwire fails closed; each of three isolated corpus runs completes successfully within 5,000 ms and the hard timeout stops hangs | unit |
| E23 | N3 | Corpus or generated authorization file changes | CODEOWNERS/W12 sensitive-path review rules require the independent security reviewers; self-approval is insufficient | process-security |

## 6. Security

| Boundary | Principal / authorization | Tenancy and validation | Logging / storage |
|---|---|---|---|
| Corpus input | CI/test runner only; no application principal | Synthetic, bounded, schema-validated records; no production data | Fixture text is not printed or persisted outside the repository |
| Guard/gateway runner | Server test code using existing exported contracts | Existing sanitise/output, wrapper, schema, limiter and session rules are the authority | No live key or prompt; failures expose only case metadata and reason codes |
| Context runner | Synthetic authorized caller through the existing context seam | Membership and target-project scope must reject forbidden rows | No project payloads or canaries in failure output |
| API authorization suite | Synthetic principals and the canonical policy map | Resource IDs and roles come from fixtures; hidden resources remain 404; handlers must not run on denial | Tokens, registration codes and bodies are never logged |

Threat coverage is T1/T2/T3/T5/T6/T11 through guard and gateway corpus cases, T4 through context
and cross-project cases, T7/T8 through deterministic limiter/auth cases, T9 through output/plain-text
and URL cases, and T10 through generated authorization cases. The runner captures `console` and the
injected logger sinks for the duration of each case and asserts that fixture text, tokens,
registration codes, secret candidates and stack metadata are absent from captured output. The
limiter corpus uses a barrier-synchronized concurrent reservation fixture and asserts the configured
cap is not exceeded. The corpus itself is protected under W12's process-security controls; its
content is untrusted data, not executable instructions.

## 7. Open questions

| ID | Question | Blocks | Owner |
|---|---|---|---|

None.

## 8. Decisions made in this spec

| ID | Decision | Why / rejected alternative | Asked by |
|---|---|---|---|
| SD1 | Use a declarative corpus with deterministic runners and a policy-derived authorization suite | Operator selected this approach. Hand-written disconnected tests were rejected for policy drift; one integrated harness was rejected for opaque failures and runtime coupling | Operator, 2026-11-09 |
| SD2 | Treat W11 as evidence over frozen W1-W4/W6 contracts; do not change guards or policy entries here | Keeps ownership boundaries and `AD-55`/`AD-26` intact; any contract change requires its owning workstream | Codex proposal, accepted with approach, 2026-11-09 |

## 9. Review record

Lenses: Implementer, Tester, Attacker, Maintainer | Rounds: 2 | Rejected findings:
the first-round suggestion rejection/rendering alternative was narrowed to omission; live-model
quality scoring remains out of scope under `AD-26`; independent review metadata remains a W12/
CODEOWNERS process control rather than an executable corpus assertion.
