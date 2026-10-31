# Shared Test Infrastructure

Test runs repeatedly pay for things that do not change between runs: starting dependencies,
migrating schemas, building runtime contexts. Several short-lived containers plus runtimes have
also caused out-of-memory crashes. Read this when setting up or debugging test dependencies.

## Principles (any stack)

1. **Start expensive, stable things once; tests only connect.** One persistent local service per dependency.
2. **Pay for schema setup once.** Migrate into a template database; clone it per worker (`ws infra db <worker>`).
3. **Isolate by name.** Every concurrent runner (worker, parallel worktree) gets its own database name, never a shared mutable one.
4. **Configuration first, self-contained fallback.** Tests read `TEST_DATABASE_URL`; if unset they start a throwaway dependency (Testcontainers or equivalent) so CI and teammates still work.
5. **One place starts each dependency.** One shared setup file per stack; flag stray container starts.
6. **Know what infra cannot fix.** Runtime-context startup is paid per distinct configuration per process: share base classes and mock sets, prefer slices over the whole app.
7. **Bound parallelism by memory, not cores.**
8. **Measure before and after** (wall time, peak memory) and adopt only what helps on the team's machines.

## Using it

1. Copy [templates/infra-template.json](templates/infra-template.json) to `workflow/infra.json` and edit.
2. Add `"test_commands": {"backend": "...", "web": "..."}` to `workflow/config.json`.
3. `ws test [component]` ensures dependencies (idempotent), runs the commands, prints a pass/fail line with only the first failing lines, and writes full logs to `.ws/logs/<component>.log` (read on request only).
4. `ws infra status | ensure | db <name> | drop <name> | down`.

Without Node or Docker: start the services by hand, export `TEST_DATABASE_URL`, run the test commands directly and read only the failing lines.

## Status

`ws test` was exercised. `ws infra ensure/db` was syntax-checked only; verify against a real container on the team's machines (including idle memory of the persistent service) before relying on it.
