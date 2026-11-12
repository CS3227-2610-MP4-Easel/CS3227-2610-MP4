# 5. Requirements

Rules the flows follow (W10). Screen-level detail is in the spec: `workflow/specs/2026-11-01-w10-ui-design/`.

## W1 foundation requirements

- Backend packages live under `src/be/api`, `src/be/db`, `src/be/contracts`, and `src/be/llm-gateway`; the frontend remains under `src/fe`.
- The contracts package owns schemas, errors, OpenAPI output, route definitions, and the policy map.
- The API boundary registers routes through the policy gate and uses typed resource-resolution seams; route handlers do not perform role checks.
- The database client filters soft-deleted and archived records, including nested returned relations and compound unique reads.
- Production migrations are CI-only; developer and pull-request environments must not use production credentials.

## Auth, gateway and AI context requirements (W4, W2, W3, W6)

- Every request is authenticated with a Firebase ID token; the application role is read from `users`, never from a claim. Registration needs a role's code, is limited to 20 attempts a minute per client, and bodies over 4 KiB are refused (W4).
- Every model call goes through `LlmGateway.run`; the browser never calls SoCLaaS and the key never enters a prompt. Limits per tier: 6 calls a minute and 200 a day per user, 25 a minute and 2,000 a day globally, a 20,000,000 µ$ daily spend cap, the breaker at 5 failures for 60 seconds, a 20-second attempt timeout and 30 minutes of session inactivity (C27).
- Any text a user typed or uploaded, and any stored model output reused as input, is untrusted: it passes the input guard and is wrapped; output must pass the output guard (W3).
- Stored data reaches a prompt only through `assembleWith`, which checks membership of the target project before and after reading (W6).
- Pull requests need one CODEOWNER approval; process-control files stay review-required (W12).

## Developer requirements (W9)

- An upload holds at most 1 MiB and 100 items (commits and pull requests: titles, short bodies, file names; no diffs). Each item belongs to the uploader; re-uploading the same item reports it unchanged. Bodies over 2,000 characters are cut and the item flagged, not rejected.
- Summaries are one line per item, made in batches of up to 10 and cached per item; a cached answer costs no model call.
- A standup is one Developer, one project, one day. It covers the Developer's item summaries and task events in the window for that date (from 00:00 Singapore time of the working day before it) plus every task blocked now, whenever it was created (C74, C75).
- Generating again with unchanged input returns the stored standup marked `cached`. When the model call fails, the standup is built from task activity only and marked `degraded`.
- The Dev Lead reads every developer member's standups for a day (55); a Developer reads only their own (52).

## Flow rules

- **Sign in and register:** an account needs a role and its registration code; an unfinished registration resumes at "Finish setup" on the next sign-in.
- **PM, plan to backlog:** a project is created, a Dev Lead added, then the plan (AI) or manual epics and tasks fill the backlog. Without AI the PM adds epics, tasks and checkpoints by hand.
- **Dev Lead, run a sprint:** every task needs story points before it can join a sprint; only one sprint is active at a time; sprint dates may not overlap.
- **Closing a sprint:** unfinished tasks move to the next sprint after confirmation (default), or to the backlog; with no planned sprint the default is the backlog (C19). A closed sprint holds only done tasks.
- **Members:** a member with open tasks cannot be removed until they are reassigned.
- **Health:** progress, velocity and checkpoint risk come from the project data without AI; forecast needs at least one closed sprint (otherwise "No forecast yet"). The PM can read the same facts (C11).
- **Standups:** the Dev Lead reads the team's standups read only; a Developer generates their own for the next standup or for today.
- **Archived project:** everything is read only.

## Core planning and role features

- **Core planning:** membership, project, epic, task and checkpoint reads are project-scoped;
  archived projects are read-only; task moves, sprint closure, plan application and membership
  mutations enforce their domain rules and serialize through the project lock (W5).
- **Dev Lead facts and digest:** facts include only allow-listed member-visible data; forecast and
  digest ordering are deterministic; persisted `factsAsOf` supports safe latest-digest selection;
  degraded gateway results do not expose private context (W8).
- **Security verification:** the authorization corpus must exercise the production route and
  package seams, deny unexpected filesystem/network/process capabilities, and remain independent
  of the guard author's review (W11).
- **Deployment safety:** recovery accepts only the code-owned synthetic target; production
  migrations run from protected CI with exact target/checksum validation, and deployment is
  triggered only after a successful migration (W13).

## Known limitations

- The data holds one project; every project id shows the same one.
- Registration always signs in as the PM.
- Plan controls act on the page only (W7).
- The digest and suggestion texts are canned until W7.
- Typed SQL remains disabled until `$queryRawTyped` is covered by the filtered-client boundary.
- Request-derived relation filters and nested writes require explicit authorization; the filtered client does not make those inputs safe by itself.
- Firebase issues tokens to unverified emails, so a registration-code holder could register an email they do not own, and a disabled user's token works for up to an hour (C47, AD-57).
- `rate_counters` rows are never cleaned up, and slow request bodies on endpoints 2 and 3 hold the function until the platform timeout.
- A few active users can exhaust the global AI windows and everyone else gets `AI_BUSY` until they reset; AI session caps and the spend cap are soft under concurrency.
- The injection flag is a floor, not a proof: lookalike characters and obfuscated personal data can evade it. The guards also lose zero-width characters on input and have known false positives (phone-like numbers, version numbers, `<a ` in prose).
- `assembleWith` checks rows, not sources: each source owner's tests must prove their rows. The gap between `assembleWith` and the model call is not re-checked at `run` time.
- The register screen shows Firebase's "email already in use", so anyone can test whether an email has an account.
- The web app's source-rule test is regex-based: it catches the usual forms, not deliberate evasion (`window['location'].assign`, `fetch (` with a space, computed imports); review covers those.
- Upload storage is unbounded: endpoint 49 has no per-user rate limit or row cap, and activity items are never deleted.
- Four or more simultaneous W9 writes to one project can run out of transaction retries; they get 429 `RATE_LIMITED` with `Retry-After: 1` (C72).
- Endpoints 49-51 answer an oversize `Content-Length` with 413 before checking the token, so an unauthenticated client sees 413, not 401.
- W9 leaves standup sessions open for edit and accept (W16), so a Developer on four or more projects can hit the 3-open DEV_STANDUP session cap within 30 minutes; a busy or refused regeneration can use a session without storing anything.
