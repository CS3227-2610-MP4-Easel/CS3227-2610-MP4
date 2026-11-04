# W12 Conventions

## Workflow

- Review approval changes are re-evaluated by a separate trusted `pull_request_review` workflow
  for `submitted`, `edited`, and `dismissed`; the workflow runs the checker from the trusted base
  revision and reads PR content only as Git object data.

- The primary workflow is triggered by `pull_request` for `development` and `main` and is stored
  under `.github/workflows/`; it never uses `pull_request_target` or a deployment trigger.
- It uses `ubuntu-24.04`, Node `20.19.5`, npm `10.8.2`, and the repository's committed
  `package-lock.json`.
- Required check names are stable and descriptive: `workspace`, `typecheck`, `lint`, `contract`,
  `dependency-audit`, `secret-scan`, and `workflow-security`.
- `workspace` runs `npm test`; `typecheck` runs `npm run typecheck`; `lint` runs `npm run lint`;
  `contract` runs the targeted OpenAPI parity tests; `dependency-audit` runs
  `npm audit --audit-level=high`; `secret-scan` runs Gitleaks `8.24.2`; and `workflow-security`
  runs `npm run check:workflows` and `npm run check:agent-policy`.
- Third-party Actions are pinned to full commit SHAs; the human reviewer records the source version
  in the workflow comment when the SHA is selected.
- The pull-request workflow uses `permissions: {}` and `actions/checkout` has
  `persist-credentials: false`; no job references a GitHub Environment or a secret.
- The approved Action repository list and exact SHAs live in `workflow/action-pins.json`; the
  workflow-control check rejects an Action not listed there.

## Secrets and environments

- Pull-request jobs do not receive production secrets or data credentials.
- Local and non-production checks use mock mode when a runtime integration would require a secret.
- Logs must not print environment values, tokens, registration codes, prompts, or database URLs.
- CI secret scanning covers the checked-out tree and the complete PR commit range; `.gitleaks.toml`,
  the hook, the scan command, and its allowlist are CODEOWNER-protected.
- `.env`, `.env.*`, generated databases, and build outputs remain ignored as established by W1.

## Review ownership

- `.github/`, `.claude/`, `.codex/`, `workflow/`, `src/be/contracts/`, and security-test paths
  are protected by `CODEOWNERS`.
- `workflow/security-sensitive-paths.json` is the canonical sensitive-path manifest with schema
  `{ "version": 1, "paths": [<non-empty unique glob strings>] }`. The security-review checker
  reads the base-branch copy after rollout, and process-security tests consume the same list;
  CODEOWNERS coverage tests must prove that every listed pattern requests `@teleifo`, `@ludannnn`,
  and `@Xiao-Congchen`. During the first rollout only, target `development` at base SHA
  `7bd65440023a0123ac92445e5b6e58ec838ee57c` and PR number equal to the externally configured
  `W12_BOOTSTRAP_PR_NUMBER` may use the fixed ordered list in API SD7 when the base manifest is
  absent. The head manifest uses duplicate-key-aware parsing, has exactly the keys `version` and
  `paths`, version `1`, unique non-empty strings, and the exact ordered list; whitespace and key
  order are insignificant, path order is significant. The variable is removed after merge. Every
  other missing or malformed base manifest fails closed, and a changed or deleted head manifest is
  validated even after rollout.
- `.github/CODEOWNERS` names `@teleifo` for protected repository paths. A teammate's human approval
  is required for protected branches; an agent review is advisory and never replaces the human approval.
- Protected branch settings apply identically to `development` and `main`, except that deployment
  and migration jobs remain restricted to `main`'s approved environment outside W12.
- Sensitive-path changes require actual GitHub `APPROVED` reviews from `@ludannnn` and an additional,
  different human GitHub approver. When the PR author
  is `@teleifo`, that approver is `@Xiao-Congchen`; otherwise it is `@teleifo`. Non-sensitive PRs use the ordinary CODEOWNER
  approval rule. The author cannot be the sole reviewer, and the security reviewer and human
  approver must be different people; CI verifies the sensitive-path approval against the exact
  PR head. No committed security-review artifact is required.
- Security findings may block a merge. An owner override must be recorded in the branch state and
  receive a second human review.

## Local scan

- Repository test discovery is implemented in Node and must not depend on shell-specific command
  substitution; discovered test paths are sorted before invocation.

- The documented staged-file command is the same Gitleaks configuration used in CI.
- `.githooks/pre-commit` runs `npm run scan:secrets -- --staged`, and `npm run setup:hooks` sets
  `core.hooksPath` to `.githooks`.
- A false-positive allowlist entry names the exact rule and file pattern, includes reason, reviewer,
  date, and expiry/revalidation trigger, and never suppresses the entire repository or a directory
  containing production configuration.

## Agent policy

- `workflow/agent-permissions.json` is the canonical policy; it has explicit `allow`, `deny`,
  `review_required`, and `content_handling` sections, and unknown operations are denied.
- `npm run check:agent-policy` validates the schema and tests default-deny, production denial,
  protected-path review, and data-not-instructions rules. Missing or malformed policy fails closed.
- Provider adapters must consult the policy before command, file, network, or secret access; the
  policy is not satisfied by documentation alone.
