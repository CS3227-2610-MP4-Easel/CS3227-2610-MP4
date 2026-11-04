# W12 Review-Evidence Interface

## Security-review checker input

The existing `check:security-review` command receives `--base-sha`, `--head-sha`, `--base-branch`,
`--pr-number`, `--bootstrap-pr-number`, and `--pr-author`. It additionally receives `--reviews-file <path>` from the `workflow-security`
job. The file contains the JSON response from the GitHub pull-request reviews endpoint for the
current pull request.

The checker reads `workflow/security-sensitive-paths.json` from `--base-sha`, validates its schema,
and classifies the changed-path set against that base manifest. For the initial rollout only, if
`--base-branch` is `development`, `--base-sha` is
`68d639a067ce514085a8074b9f18fa0c3ab3ed06`, `--pr-number` equals the externally configured
`--bootstrap-pr-number`, and the base manifest is absent, it uses this fixed
bootstrap list, in this exact order:

```json
[".github/**", "CODEOWNERS", "package.json", "package-lock.json", ".githooks/**", ".gitleaks.toml", ".gitleaksignore", ".gitignore", "scripts/**", "workflow/**", ".claude/**", ".codex/**", "src/be/contracts/**", "src/be/*/test/**", "tests/**", "tests/security/attack-corpus/**"]
```

The head manifest must be parsed by a duplicate-key-aware JSON parser, then contain exactly
`version` and `paths`, version `1`, and that exact ordered array; duplicate keys, unknown keys,
duplicate paths, or malformed JSON fail before semantic comparison. Whitespace and object-key order
do not matter. The checker reads the head
manifest with `git show <head-sha>:workflow/security-sensitive-paths.json`, not from the workspace.
For any other target/base/PR-number combination, a missing or malformed base manifest fails closed.
If the head changes or deletes the manifest, its head copy must validate even after rollout. The
repository variable is removed after the first W12 merge, so a second PR cannot enter bootstrap.

Each review record must contain `user.login`, `state`, `commit_id`, `submitted_at`, and `id`.
The checker normalizes both the PR-author and reviewer logins to the repository's `@handle` form
at the boundary. For each required reviewer, the checker sorts all records by `submitted_at` and
then `id`, selects that reviewer's latest record, and requires its `state` to be `APPROVED` and its
`commit_id` to equal the exact PR head SHA. `CHANGES_REQUESTED` and `DISMISSED` are failing latest
states; an approval on an older head also fails. The trusted reviewer set is
`@teleifo`, `@ludannnn`, and `@Xiao-Congchen`. For every sensitive PR, the author is excluded and
the other two trusted people are required exactly once: one as the security reviewer and the other
as the human approver. Either of those two people may fill either role. The checker must consume
all paginated review results. Non-sensitive PRs do not use this additional checker requirement.

The workflow-security job sets job-level `permissions: { pull-requests: read }` while all other jobs
retain the top-level empty permission set. It runs the preinstalled GitHub CLI with
`GH_TOKEN: ${{ github.token }}` and `gh api --paginate --slurp "/repos/${GITHUB_REPOSITORY}/pulls/${{ github.event.pull_request.number }}/reviews"`, writes the complete nested JSON response to `$RUNNER_TEMP/pr-reviews.json`, and passes that path through `--reviews-file` and `--base-branch`. The file is outside the checked-out PR workspace and is not writable by PR files. If the endpoint fails, the file is absent, the JSON is malformed, or no matching
review exists, the checker exits non-zero. No committed security-review artifact is read or required;
actual GitHub review records are authoritative and sufficient for both approvals. The workflow passes the event target branch, pull-request number,
and `W12_BOOTSTRAP_PR_NUMBER` repository variable to the checker; the variable is configured only
for the allowlisted rollout PR and is removed after that PR merges.

## Trusted review-event workflow

The trusted workflow is triggered by `pull_request_review` activity types `submitted`, `edited`, and
`dismissed`. It is a pre-merge rollout prerequisite: the workflow must already be present on the
default branch through an independently protected change before it can rerun this PR's gate.
GitHub loads this workflow from the default branch, not from the PR head. It checks out
the trusted workflow revision, obtains the PR head SHA and base SHA from the event payload, and
fetches the PR head Git objects without executing package scripts, workflow files, or checkers from
the PR. It runs the trusted base revision's checker against the Git object range and writes the
review response to a runner-temporary file. The job has only `contents: read` and
`pull-requests: read` permissions and publishes the `workflow-security` check context.

The checker CLI maps dashed options to the validator's camel-case option names before calling the
validator. A missing or invalid base revision, bootstrap identity, or PR head causes a non-zero
exit. Changed-path classification uses `git diff --no-renames --name-status`; a rename is therefore
represented by separate `D` and `A` records, and both paths are classified independently.

The root `npm test` script invokes a repository Node-based test-discovery helper rather than shell
command substitution. The helper recursively lists `.test.ts` files beneath `tests` and `src/be`,
sorts them lexicographically, and passes them as arguments to Node's test runner.
