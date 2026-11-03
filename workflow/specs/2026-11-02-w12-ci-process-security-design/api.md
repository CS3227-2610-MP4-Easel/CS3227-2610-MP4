# W12 Review-Evidence Interface

## Security-review checker input

The existing `check:security-review` command receives `--base-sha`, `--head-sha`, and
`--pr-author`. It additionally receives `--reviews-file <path>` from the `workflow-security`
job. The file contains the JSON response from the GitHub pull-request reviews endpoint for the
current pull request.

The checker reads `workflow/security-sensitive-paths.json` from `--base-sha`, validates its schema,
and classifies the changed-path set against that base manifest. It fails closed if the base
manifest is missing or malformed; changes to the manifest itself are sensitive because the manifest
matches `workflow/**`.

Each review record must contain `user.login`, `state`, `commit_id`, `submitted_at`, and `id`.
The checker normalizes both the PR-author and reviewer logins to the repository's `@handle` form
at the boundary. For each required reviewer, the checker sorts all records by `submitted_at` and
then `id`, selects that reviewer's latest record, and requires its `state` to be `APPROVED` and its
`commit_id` to equal the exact PR head SHA. `CHANGES_REQUESTED` and `DISMISSED` are failing latest
states; an approval on an older head also fails. The required reviewers are `@ludannnn` and
`@Xiao-Congchen` for a `teleifo` PR, or `@ludannnn` and `@teleifo` for any other sensitive PR
author. The checker must consume all paginated review results. Non-sensitive PRs do not use this
additional checker requirement.

The workflow-security job sets job-level `permissions: { pull-requests: read }` while all other jobs
retain the top-level empty permission set. It runs the preinstalled GitHub CLI with
`GH_TOKEN: ${{ github.token }}` and `gh api --paginate --slurp "/repos/${GITHUB_REPOSITORY}/pulls/${{ github.event.pull_request.number }}/reviews"`, writes the complete nested JSON response to `$RUNNER_TEMP/pr-reviews.json`, and passes that path through `--reviews-file`. The file is outside the checked-out PR workspace and is not writable by PR files. If the endpoint fails, the file is absent, the JSON is malformed, or no matching
review exists, the checker exits non-zero. The artifact's reviewer identity, decision, and
`humanApproval` object remain supporting audit metadata; actual GitHub review records are
authoritative for both approvals.
