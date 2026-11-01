# W12 Conventions

## Workflow

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

- `.github/`, `.claude/`, `.codex/`, `workflow/`, `packages/contracts/`, and security-test paths
  are protected by `CODEOWNERS`.
- `.github/CODEOWNERS` names `@teleifo` for protected repository paths. A teammate's human approval
  is required for protected branches; an agent review is advisory and never replaces the human approval.
- Protected branch settings apply identically to `development` and `main`, except that deployment
  and migration jobs remain restricted to `main`'s approved environment outside W12.
- Security-relevant AI-written changes require the security-reviewer agent and human approval from
  `@ludannnn`; the author cannot be the sole reviewer.
- Security findings may block a merge. An owner override must be recorded in the branch state and
  receive a second human review.

## Local scan

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
