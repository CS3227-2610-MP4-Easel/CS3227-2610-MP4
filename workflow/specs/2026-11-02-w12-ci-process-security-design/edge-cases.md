# W12 Edge Cases

| ID | Requirement | Scenario | Expected behaviour (exact) | Why it matters | Test layer |
|---|---|---|---|---|---|
| E1 | F1, N3 | A PR changes application code | All seven required checks run and each result is visible by its stable name; a missing check blocks merge | Prevents an apparently green PR with a skipped control | integration |
| E2 | F2 | The lockfile is stale or an install script is present | `npm ci --ignore-scripts` exits non-zero for lock drift and executes no dependency lifecycle script | Stops CI from testing a different graph or running untrusted install code | integration |
| E3 | F3, F4 | A policy entry has no generated OpenAPI operation | The contract check exits non-zero and identifies the missing operation | Prevents route-policy drift | integration |
| E4 | F5, F12 | A staged file contains a test canary that matches the scanner rule | Local scan exits non-zero; CI scan also exits non-zero | Proves both enforcement points measure the same risk | unit/integration |
| E5 | F5 | A documented false positive is added | Only the exact reviewed rule/file pattern is ignored; another matching file still fails | Prevents broad secret-scan bypasses | integration |
| E6 | F6, N1 | The audit service is unavailable or its advisory database changes | The dependency-audit check fails closed on unavailable service and records the advisory source/input; N1 does not claim identical results across advisory updates | Avoids treating an unevaluated dependency set as safe | integration |
| E7 | F7 | A workflow references an Action by tag, branch, unapproved repository, or non-40-character SHA | `workflow-security` exits non-zero and identifies the file and reference | Prevents mutable or unapproved supply-chain inputs | integration |
| E8 | F8, F10, F13 | An agent or PR edits its own permission policy, adapter, CODEOWNERS, workflow, or scanner config | The policy check fails closed and GitHub requires the named human owner plus security-reviewer review; for a PR authored by `@teleifo`, `@Xiao-Congchen` must provide human approval; self-approval cannot satisfy it | Prevents self-authorized control changes | integration/manual |
| E9 | F8, F13 | Attack-corpus text contains instruction-like content | The adapter passes it as data, denies protected-path writes, and requires the security-reviewer and a different human owner; for a PR authored by `@teleifo`, that owner is `@Xiao-Congchen` | Tests the A-17 process threat | manual |
| E10 | F9 | A required check is skipped, a stale approval remains after a new commit, the author approves, or a branch has no CODEOWNER approval | GitHub reports the branch blocked and refuses merge on both `development` and `main` | Ensures repository settings enforce the written policy | manual |
| E11 | F9 | A user attempts direct push, force push, deletion, or administrator bypass on either protected branch | GitHub rejects the operation | Prevents bypass of review and checks | manual |
| E12 | F11, N2 | A PR comes from a fork or an untrusted same-repository branch | The `pull_request` workflow has no secrets/environments, uses a hosted runner and `permissions: {}`, does not use `pull_request_target`, and cannot deploy or write | Prevents secret exfiltration through untrusted code | manual |
| E13 | F5, F12 | A secret is in a renamed file, an earlier PR commit, or the scanner allowlist is widened | CI scans the checked-out tree and PR commit range; protected configuration changes require review and broad/stale allowlists fail the policy check | Prevents scan-scope and configuration bypasses | integration/manual |
| E14 | N3 | A command prints a secret-like environment value or a check fails | The workflow does not provide credentials to the job, records the command and exit status, and retains failure output without the canary value | Logs are durable and externally visible | manual |
| E15 | N1, N4 | W1 has not yet merged into INT | W12 spec and policy work may proceed, but implementation checks that consume W1 scripts remain gated until the W1 base is available | Keeps dependency order explicit | manual |
| E16 | F13 | A sensitive PR authored by `@teleifo` supplies `@teleifo` or `@ludannnn` as the human approver, or omits `@Xiao-Congchen` | The security-review check fails with the required approver `@Xiao-Congchen`; `@ludannnn` remains the security reviewer and cannot also satisfy human approval | Prevents Dev Lead self-approval and dual-use of one reviewer | unit/integration |
| E17 | F13, N2 | The artifact claims approval, but the GitHub review list has no current `APPROVED` review by the required approver or security reviewer for the exact PR head | The security-review check fails; the committed artifact alone never satisfies either approval for a sensitive PR | Prevents forged approval evidence from the untrusted PR head | integration |
| E18 | F13 | `@ludannnn` authors a sensitive PR | The security-review check fails closed because the configured security reviewer is the PR author and no alternate security reviewer exists | Prevents self-authored security review | unit/integration |
| E19 | F13 | A required reviewer approves, then submits `CHANGES_REQUESTED` or has the approval dismissed at the same head | The latest review state is `CHANGES_REQUESTED` or `DISMISSED`, so the security-review check fails until a new approval is submitted | Prevents withdrawn or superseded approval from remaining valid | integration |
| E20 | F13 | The GitHub reviews endpoint returns multiple pages | The checker fetches and evaluates every page before deciding whether both current approvals exist | Prevents a missing later review from causing a false failure or false pass | integration |

## What could corrupt data

W12 does not write application data directly. A compromised workflow could still corrupt the
repository or deployment state by merging unreviewed code, changing Prisma migrations, altering the
policy map, weakening the scanner, or deploying with production credentials. Required checks,
protected branches, `CODEOWNERS`, default-deny agent policy, read-only PR tokens, protected scanner
configuration, and the production-secret boundary prevent those paths. A failed check or unavailable
audit fails closed; no recovery migration or production rollback is performed by W12.
