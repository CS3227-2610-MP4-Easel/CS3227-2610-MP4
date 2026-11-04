# W12 Requirements

## Functional requirements

### F1 — Pull-request verification

Given a pull request targets `development` or `main`, when the workflow runs, then it executes the
repository's locked npm install and reports these seven independently required checks: `workspace`,
`typecheck`, `lint`, `contract`, `dependency-audit`, `secret-scan`, and `workflow-security`.

### F2 — Reproducible dependency installation

Given `package-lock.json` is present, when CI installs dependencies, then it uses
`npm ci --ignore-scripts` and fails if the lockfile and manifests disagree.

### F3 — Repository test evidence

Given the W1 workspace scripts exist, when CI runs, then `npm test`, `npm run typecheck`, and
`npm run lint` run from the repository root and their exit status is recorded by the named required
check that owns each command: `workspace`, `typecheck`, and `lint` respectively.

### F4 — Contract evidence

Given the contracts and policy map are present, when CI runs, then `contract` executes the targeted
OpenAPI parity tests separately from `workspace` and fails if an operation is missing, duplicated,
or has a mismatched policy key, schema reference, or success status.

### F5 — Secret detection

Given a commit or pull request contains a detectable secret, when the local staged-file scan or CI
scan runs, then it exits non-zero and the commit or required check cannot pass until the secret is
removed or an explicit, reviewed false-positive rule is added.

### F6 — Dependency audit

Given the lockfile declares an installable dependency with a high or critical known vulnerability,
when CI audits dependencies, then the required check fails and reports the package and severity.

### F7 — Workflow supply-chain control

Given a workflow uses a third-party GitHub Action, when `workflow-security` runs, then
`npm run check:workflows` scans every `.github/workflows/*.yml` and `.yaml` file, rejects any
`uses:` reference that is not a full 40-character commit SHA, rejects an action repository outside
the approved repository list, and fails the required check with the path and offending reference.

### F8 — Agent permission policy

Given an agent runs in the repository, when the adapter wrapper evaluates
`workflow/agent-permissions.json`, then a missing, malformed, or non-conforming policy fails closed;
the default is deny; production credentials and production hosts are denied; writes to
`tests/security/attack-corpus/**`, `.github/**`, `workflow/agent-permissions.json`, and
`.githooks/**` require the security-reviewer and a human owner; and repository/web content is passed
as data rather than executable instructions. `npm run check:agent-policy` must return non-zero for a
policy that violates any of these rules.

### F9 — Human review and protected branches

Given a change targets `development` or `main`, when GitHub evaluates mergeability, then all seven
required checks and one CODEOWNER teammate approval are required; stale approvals are dismissed,
approval of the latest push is required, pull-request authors cannot self-approve, administrators
cannot bypass the rules, direct pushes are denied, and force pushes/deletions are denied.

### F10 — Sensitive-path ownership

Given a pull request changes any path in the canonical sensitive-path manifest
`workflow/security-sensitive-paths.json` (`.github/**`, `CODEOWNERS`, `package.json`,
`package-lock.json`, `.githooks/**`, `.gitleaks.toml`, `.gitleaksignore`, `.gitignore`,
`scripts/**`, `workflow/**`, `.claude/**`, `.codex/**`, `src/be/contracts/**`,
`src/be/*/test/**`, `tests/**`, or `tests/security/attack-corpus/**`), when GitHub evaluates
reviewers, then `CODEOWNERS` requests the named repository owner and security reviewers, and the
change cannot merge without the required CODEOWNER review plus the two current exact-head reviews
specified by F13.

### F11 — Credential isolation

Given a pull-request workflow runs from an untrusted branch or fork, when it executes through the
`pull_request` event, then it uses a GitHub-hosted runner, has no environment or repository secrets,
has `permissions: {}`, uses `persist-credentials: false`, checks out the untrusted head only for
read-only verification, and cannot perform a deployment. The workflow must not use
`pull_request_target`, self-hosted runners, or deployment steps.

### F12 — Local pre-commit scan

Given a contributor stages files, when the repository's `.githooks/pre-commit` runs
`npm run scan:secrets -- --staged`, then the secret scanner examines staged content and returns a
non-zero result for a detected secret. `npm run setup:hooks` configures the repository's hook path;
`--no-verify` may bypass the local hook but cannot bypass the CI check.

### F13 — Security cross-review

Given a change includes any path matching the base-branch canonical sensitive-path manifest, when
the pull request is reviewed, then `@ludannnn` submits an actual GitHub `APPROVED` review for the
exact PR head. A different human must also submit an actual GitHub `APPROVED` review for that head. For
a sensitive PR authored by `@teleifo`, the human approver is `@Xiao-Congchen`; for a sensitive PR
authored by any other author, the human approver is `@teleifo`. Non-sensitive PRs follow the
ordinary CODEOWNER rules. The author cannot be either reviewer, and a sensitive PR authored by
`@ludannnn` fails closed because no alternate security reviewer is configured.

### F14 — First-rollout manifest bootstrap

Given the base revision does not contain `workflow/security-sensitive-paths.json`, when T6 runs
for the initial W12 rollout targeting `development` from base SHA
`7bd65440023a0123ac92445e5b6e58ec838ee57c` and the pull-request number equals the externally
configured repository variable `W12_BOOTSTRAP_PR_NUMBER`, then it uses the fixed bootstrap list in API SD7 and
requires the head revision to contain a manifest with exactly the keys `version` and `paths`,
`version: 1`, unique non-empty string paths in the exact normative order, and no unknown keys.
Whitespace and object-key order are insignificant after parsing; path-array order is significant.
If the head manifest is absent, malformed, has duplicate keys or paths, contains unknown keys, or
differs from the normative list, the check fails closed. Duplicate JSON object keys are rejected
before semantic parsing. Any other target branch, base SHA, or pull-request number, or any later
base revision missing the manifest, fails closed. Every head revision must also validate
the manifest if it changes or deletes it, even when classification uses the base copy.

### F15 — Review-event re-evaluation

Given a sensitive pull request receives a review submission, review edit, or review dismissal, when
the trusted workflow runs, then it publishes the sole required `workflow-security` result using the
same exact-head approval rules as the pull-request workflow. It also runs for PR opened,
synchronize, and reopened events, runs from the trusted base revision, treats PR files only as Git
object data, and fails closed when the event head is no longer the current PR head.

### F16 — Workflow checker CLI argument binding

Given `check:workflows` receives `--base-sha`, `--base-branch`, `--pr-number`, and
`--bootstrap-pr-number`, when its command-line entry point runs, then each value reaches the
corresponding validator option and an invalid base SHA or bootstrap identity fails closed.

### F17 — Rename-safe sensitive path classification

Given a sensitive file is renamed or moved to a non-sensitive path, when the security-review
checker classifies the PR range, then both the source and destination paths are considered and the
change requires sensitive review.

### F18 — Cross-platform test discovery

Given a contributor runs `npm test` on Windows using the default npm shell, when tests are
discovered, then the command does not depend on POSIX command substitution and discovers every
`.test.ts` file under `tests` and `src/be`.

## Non-functional requirements

### N1 — Deterministic enforcement

The same repository commit must produce the same required-check names and pass/fail decision when
run twice with the same dependency, scanner, runtime, and workflow-action inputs. External advisory
database updates are not part of this determinism claim and are recorded as audit inputs.

### N2 — Least privilege

The default workflow token has read access to repository contents and metadata only; write access is
granted to no job; the PR workflow uses `permissions: {}` and a later approved workstream must add
any narrowly scoped permission.

### N3 — Auditability

Each required check names its command, records its exit status in the workflow log, and retains
failure output as a standard GitHub Actions log without printing credentials or token values.

### N4 — Reviewability

The complete W12 control surface is limited to repository files, GitHub repository settings, one
PR workflow, and one trusted review-event workflow; no new server, database table, or runtime
endpoint is introduced.
