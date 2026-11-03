# W1 Review Repairs and Contract Reconciliation Design

- **Status:** Approved (Dev Lead, 2026-11-02)
- **Amended 2026-11-02:** endpoint-42 contract reversal and explicit seam semantics added after Implementer, Tester, Maintainer, and Attacker review.
- **Risk tier:** High - authorization and tenant visibility rules change, while the public API contract is reconciled with PR #6.
- **Workstream:** W1 | **Plan:** pending Gate 1 approval
- **Constraints consulted:** `guardrails.md` (AD-01b, AD-25, AD-55, AD-32); architecture §7 object-level rules; architecture §11 time rules; `docs/architecture/contracts.md`; W1 branch state.
- **Review lenses:** Implementer, Tester / QA, Maintainer, Attacker

## 1. Problem

The latest review of PR #5 found four defects in the frozen authorization, database visibility, and OpenAPI seams. The current authorization treats every `{id}` as a project ID, the Prisma read extension filters only root queries, the unique-read proxy sends compound selectors to `findFirst`, and OpenAPI emits `$ref` values without definitions. These defects cause false 404s, data leakage through nested reads, runtime query failures, and unusable generated documentation.

Current behaviour is preserved by 45 tests but those tests do not exercise the failing paths. Desired behaviour is that every path resource is resolved to its owning project before membership checks, all request-facing nested reads obey active/not-deleted visibility, unique reads remain valid for scalar and compound keys, and every generated reference resolves to a schema definition.

PR #6 also records contract handovers that must be reflected before W1 is merged: project list rows use `ProjectDetail`; facts are available at `GET /api/projects/{id}/facts` to PM and Dev Lead members; endpoint 36 remains a Tier 1 PM continuation surface; and standup generation accepts today or the next working day in `Asia/Singapore` while preserving the existing activity-window rule.

## 2. Goals

See [requirements](2026-11-02-w1-review-repairs-design/requirements.md) for the six testable functional and non-functional requirements.

## 3. Non-goals

- No persisted-data model or migration change; the existing schema already contains the required project ownership fields.
- No implementation of W2-W9 runtime features; only their W1-facing contract inputs are aligned.
- No GitHub integration or PR-diff ingestion, per guardrail AD-20.
- No maintenance-client opt-out; request-facing reads remain filtered per AD-25 and the W1 security boundary.

## 4. Components

- [Requirements](2026-11-02-w1-review-repairs-design/requirements.md) — ordered functional and non-functional acceptance criteria.
- [API contract and authorization](2026-11-02-w1-review-repairs-design/api.md) — route-to-project resolution, policy changes, OpenAPI output, and security rules.
- [Conventions](2026-11-02-w1-review-repairs-design/conventions.md) — seam placement, visibility and contract-generation rules applied by this change.
- [Edge cases](2026-11-02-w1-review-repairs-design/edge-cases.md) — exact observable behaviour for security, query, contract, and date cases.
- [Implementation order](2026-11-02-w1-review-repairs-design/implementation-order.md) — dependency-ordered tasks for the implementation plan.

No data-model component: no persisted entities, columns, keys, or migrations change.

## 5. Open questions

| ID | Question | Blocks | Owner |
|---|---|---|---|
| — | None | — | — |

## 6. Decisions made in this spec

| ID | Decision | Why / rejected alternative | Asked by |
|---|---|---|---|
| SD1 | Repair the existing seams in place. | Preserves frozen public interfaces and avoids the larger repository refactor. | Operator selected approach 1 on 2026-11-02. |
| SD2 | Resolve resource ownership through an authorization dependency before membership checks; do not infer ownership from a client-supplied resource ID. | Satisfies AD-55 and the architecture object-level rule; a generic `params.id` membership check is the reviewed defect. | Codex proposal accepted with approach 1. |
| SD3 | OpenAPI component schemas are generated from the route schema registry and every `$ref` must resolve. | Keeps policy entries compact while making the document consumable; inlining each schema would duplicate contracts. | Codex proposal under approach 1. |
| SD4 | Reverse C~1 for endpoint 42 only: adopt PR #6's `GET /api/projects/{id}/facts` PM-plus-Dev-Lead contract and update the normative contract/architecture sources. | The operator explicitly accepted PR #6's behavior on 2026-11-02; retaining the old route would leave the approved UI handover incompatible with W1. | Operator decision. |
