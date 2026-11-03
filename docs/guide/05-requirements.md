# 5. Requirements

Rules the flows follow (W10). Screen-level detail is in the spec: `workflow/specs/2026-11-01-w10-ui-design/`.

## W1 foundation requirements

- Backend packages live under `src/be/api`, `src/be/db`, `src/be/contracts`, and `src/be/llm-gateway`; the frontend remains under `src/fe`.
- The contracts package owns schemas, errors, OpenAPI output, route definitions, and the policy map.
- The API boundary registers routes through the policy gate and uses typed resource-resolution seams; route handlers do not perform role checks.
- The database client filters soft-deleted and archived records, including nested returned relations and compound unique reads.
- Production migrations are CI-only; developer and pull-request environments must not use production credentials.

## Flow rules

- **Sign in and register:** an account needs a role and its registration code; an unfinished registration resumes at "Finish setup" on the next sign-in.
- **PM, plan to backlog:** a project is created, a Dev Lead added, then the plan (AI) or manual epics and tasks fill the backlog. Without AI the PM adds epics, tasks and checkpoints by hand.
- **Dev Lead, run a sprint:** every task needs story points before it can join a sprint; only one sprint is active at a time; sprint dates may not overlap.
- **Closing a sprint:** unfinished tasks move to the next sprint after confirmation (default), or to the backlog; with no planned sprint the default is the backlog (C19). A closed sprint holds only done tasks.
- **Members:** a member with open tasks cannot be removed until they are reassigned.
- **Health:** progress, velocity and checkpoint risk come from the project data without AI; forecast needs at least one closed sprint (otherwise "No forecast yet"). The PM can read the same facts (C11).
- **Standups:** the Dev Lead reads the team's standups read only; a Developer generates their own for the next standup or for today.
- **Archived project:** everything is read only.

## Known limitations

- The data holds one project; every project id shows the same one.
- Registration always signs in as the PM.
- Plan controls act on the page only (W7).
- The digest and suggestion texts are canned until W7.
- Typed SQL remains disabled until `$queryRawTyped` is covered by the filtered-client boundary.
- Request-derived relation filters and nested writes require explicit authorization; the filtered client does not make those inputs safe by itself.
