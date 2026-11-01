# W1 Data Model

## Normative model source

`docs/architecture/agile-platform-architecture.md` §5 is the single source of truth for the 18 models, every field, scalar type, nullability, default, enum, relation, index, composite foreign key, lifecycle rule, and server-managed field. W1 does not duplicate that table. If the generated Prisma schema disagrees with §5, the branch stops and the discrepancy is fixed before the W1 review.

`packages/db` owns the Prisma schema, migrations, generated client, and filtered-client adapter. `core`, `auth`, `proposals`, `lead`, `dev`, and `llm-gateway` are domain modules owned by later workstreams; W1 creates their table contracts and package import seams but not their behavior.

## Required schema verification

The W1 schema test compares the generated Prisma DMMF and migration SQL with architecture §5. It checks model names, field names, Prisma scalar types, nullability, defaults, enum members, primary keys, unique constraints, indexes, composite foreign keys, and relation delete behavior. The test also checks the lifecycle rules for archive, soft delete, append-only events, proposal/session state, and server-managed fields.

Every project-scoped child relation listed in architecture §5 must preserve the project id in its foreign-key constraint. For resources whose architecture relation is not composite, the owning module must resolve the resource within the caller's project before returning or mutating it; the required external behavior is `404 NOT_FOUND` for a path/resource outside the caller's projects.

Every mutable update uses an atomic compare-and-increment in the owning transaction: `UPDATE ... WHERE id = input.id AND version = input.version`, exactly one affected row, then `version = version + 1`; zero affected rows maps to `409 CONFLICT_VERSION`.

## Filtered-client seam

The exported request-facing client is `FilteredDbClient`. Its `findUnique`, `findFirst`, `findMany`, `count`, `aggregate`, and `groupBy` operations, plus `include` and nested relation reads, automatically add `deleted_at IS NULL` to soft-deletable models and exclude rows whose project is `ARCHIVED`. It exposes no raw SQL method.

The maintenance capability is a branded, non-exported type created only by `packages/db/src/maintenance.ts` from a CI migration/repair entry point:

```ts
type MaintenanceRead = { readonly __maintenanceRead: unique symbol };
withMaintenanceRead<T>(capability: MaintenanceRead, callback: (db: MaintenanceDb) => Promise<T>): Promise<T>;
```

`MaintenanceRead` is not exported through any application package. Request-facing packages cannot import `maintenance.ts`, construct the brand, invoke `withMaintenanceRead`, or issue raw SQL. Tests use source-scan rules and an import-failure fixture to prove the boundary.

`Core.assertWritable(projectId)` owns archive-state behavior. It performs an explicit project-state lookup and throws `CONFLICT_STATE` for an archived project; `Core.requireMember(userId, projectId)` owns caller membership and throws `NOT_FOUND` for a missing or non-member project. Every project-scoped mutation calls both through its owning module before changing data.

## Migration and recovery procedure

- `prisma` and `@prisma/client` versions are pinned in the root `package.json` and lockfile.
- Local schema changes use `npx prisma migrate dev --name <name> --schema packages/db/prisma/schema.prisma`; generation uses `npx prisma generate --schema packages/db/prisma/schema.prisma`.
- CI validates the schema with `npx prisma validate`, regenerates the client, runs the clean-database migration test, and applies committed migrations with `npx prisma migrate deploy`.
- Production migration runs only in the protected GitHub Environment job from `main`, with `DATABASE_URL` and `DIRECT_DATABASE_URL` supplied by that environment. Pull-request jobs and developer shells cannot access production credentials.
- The compatibility test starts the previous application schema, applies the new migration, and verifies the previous application can read and write its supported fields. Destructive drops, incompatible renames, and irreversible data transforms fail the check.
- The recovery evidence file is `docs/operations/database-recovery.md`. W13 records the Neon plan backup/restore check, a restore rehearsal result, seed-data reapplication result, and timestamps proving the maximum 24-hour recovery-point loss and 4-hour recovery-time targets. A failed migration blocks deployment; recovery is a manual restore followed by a forward migration, never a down migration.

