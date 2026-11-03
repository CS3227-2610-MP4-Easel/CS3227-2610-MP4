# Conventions

- Authorization resource resolution belongs in the shared API authorization dependency seam; handlers do not perform role checks, per AD-55.
- Route resources are resolved inside the caller's member projects before object access, matching the architecture §7 object-level rule.
- Visibility predicates are additive: existing caller filters are retained and combined with the default active/not-deleted predicate using an AND-safe structure.
- The request-facing Prisma client has no bypass flag. Maintenance-only access is a separate capability and remains unavailable to request handlers.
- Compound unique selectors are normalized only at the DB seam; public consumers continue using Prisma's generated selector names.
- OpenAPI operation IDs and policy keys remain stable. Internal `$ref` targets use `#/components/schemas/<name>` and are registered exactly once.
- Date validation uses the configured application zone `Asia/Singapore`, Monday-Friday working days, and the existing AD-44 activity window.
- Tests name the requirement or edge-case ID they prove and must include a regression test for every review finding.
- Canonical resource ownership is resolved by the module that owns the referenced table; API middleware consumes resolver interfaces and never imports Prisma models.
- A route with both a resource ID and a project ID must verify they resolve to the same project; mismatch is `NOT_FOUND`, never a client-selectable override.
- OpenAPI generation fails deterministically on unresolved or conflicting component references; parity tests walk all operations and both request and response schemas.
- `packages/contracts/src/authorization.ts` owns shared authorization types; API middleware composes owner-provided adapters and never imports an owner table or Prisma model.
- `packages/contracts/src/openapi-schemas.ts` owns the one operation-ref-to-JSON-Schema registry; `packages/contracts/src/schemas.ts` remains the canonical domain-schema source and operation envelopes are named adapters, not duplicated policy literals.
- `packages/db/src/visibility.ts` owns the immutable model/relation visibility registry; a schema-model parity test fails when a request-facing model lacks a policy entry.
