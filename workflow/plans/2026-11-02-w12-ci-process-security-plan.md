# W12 CI and Process Security Implementation Plan

- **Status:** Approved (Dev Lead, 2026-11-03)

> **For agents:** tick `- [ ]` -> `- [x]` as each step finishes, in this file and the same commit as the work. Keep the W12 branch state Progress cell current. Spec: [W12 design](../specs/2026-11-02-w12-ci-process-security-design.md).

## Scope

**Goal:** Enforce the selected thin CI and process-security baseline before changes reach `development` or `main`.

**In scope:** F1–F13, N1–N4, E1–E15.

**Non-goals:** Production deployment and migrations (W13); a custom policy-as-code framework; signed commits; full static-analysis suites; runtime security monitoring; changing the policy map, OpenAPI generator, or attack corpus contents.

**Risk tier:** High — repository permissions, secrets, workflow supply chain, and merge authority require fail-closed verification and independent review.

## Task order

| Task | Depends on | Can run concurrently with | Wave | Status |
|---|---|---|---|---|
| T1 Pull-request workflow and isolated checks | W1 merged into INT | T2, T3, T4 | 1 | Done |
| T2 Secret scanning and staged-file hook | — | T1, T3, T4 | 1 | Done |
| T3 Dependency audit and Action-pin verification | — | T1, T2, T4 | 1 | Done |
| T4 Agent policy and protected control paths | — | T1, T2, T3 | 1 | Done |
| T5 CODEOWNERS and branch protection | T4, Q1 resolved | — | 2 | Not started |
| T6 Security evidence and final verification | T1, T2, T3, T4, T5 | — | 3 | Not started |

## Traceability

| Requirement | Task(s) | Verified by |
|---|---|---|
| F1 | T1 | CI workflow check-context manual verification |
| F2 | T1 | locked-install fixture |
| F3 | T1 | workspace/typecheck/lint CI runs |
| F4 | T1, T6 | OpenAPI parity negative fixtures |
| F5 | T2, T6 | Gitleaks secret fixtures |
| F6 | T3, T6 | controlled audit result and unavailable-service check |
| F7 | T3, T6 | Action-pin and remote-execution fixtures |
| F8 | T4, T6 | agent-policy contract tests |
| F9 | T5, T6 | GitHub branch-rule verification |
| F10 | T5, T6 | CODEOWNERS path fixtures |
| F11 | T1, T6 | fork and same-repository untrusted-branch manual check |
| F12 | T2 | staged-file hook fixture |
| F13 | T4, T5, T6 | head-bound security-review evidence check |
| N1 | T1, T3, T6 | repeated-run and pinned-input evidence |
| N2 | T1, T4, T5 | workflow/policy permission checks |
| N3 | T1, T2, T6 | command-status and redaction verification |
| N4 | T4, T5, T6 | control-surface inventory |
| E1 | T1 | all required check contexts present |
| E2 | T1 | lock drift and lifecycle-script fixtures |
| E3 | T1, T6 | missing-operation fixture |
| E4 | T2 | secret canary fixture |
| E5 | T2, T6 | narrow allowlist fixture |
| E6 | T3 | audit-service failure fixture |
| E7 | T3 | tag/branch/unapproved-SHA fixture |
| E8 | T4, T5 | protected-policy review fixture |
| E9 | T4, T6 | attack-corpus data-handling fixture |
| E10 | T5, T6 | stale/self approval fixture |
| E11 | T5 | direct/force/deletion/bypass manual checks |
| E12 | T1, T6 | fork and same-repository PR isolation check |
| E13 | T2, T3, T6 | scan/audit configuration protection checks |
| E14 | T1, T2, T6 | redacted failure logs |
| E15 | T1 | W1 dependency gate check |

## Verification gates

- Per task: `npm test`, `npm run typecheck`, `npm run lint`, targeted `node --test tests/process-security/*.test.ts`, and `git diff --check`.
- Before finishing: `npm test`, `npm run typecheck`, `npm run lint`, `npm --workspace @agile/db run prisma:validate`, `node .claude/skills/writing-specs-lite/scripts/lint.mjs spec workflow/specs/2026-11-02-w12-ci-process-security-design.md --approved`, `node .claude/skills/writing-specs-lite/scripts/lint.mjs plan workflow/plans/2026-11-02-w12-ci-process-security-plan.md --approved`, all manual GitHub settings checks, and a clean working tree.

## Gate 2

- [x] **GATE:** Ask the operator to approve this implementation plan before coding. Approved by the Dev Lead on 2026-11-03; plan status and branch state updated, and approved plan lint passes.

---

### T1: Pull-request workflow and isolated checks

**Delivers:** A `pull_request` workflow with seven independently required, secretless checks and W1-backed commands. T1 owns the base workflow wiring; later tasks add the scripts it invokes, and only T6 extends the existing `workflow-security` job. **Satisfies:** F1, F2, F3, F4, F11, N1, N2, N3, E1, E2, E3, E12, E15. **Depends on:** W1 merged into INT. **Wave:** 1.

**Files**

| Action | Path | What changes |
|---|---|---|
| Create | `.github/workflows/ci.yml` | Define `pull_request` validation for `development` and `main`, `ubuntu-24.04`, Node `20.19.5`, npm `10.8.2`, `permissions: {}`, `persist-credentials: false`, no environments/secrets, and the seven exact check contexts from the spec. |
| Modify | `package.json` | Add the explicit Prisma generation pretest, the exact `check:workflows`, `check:agent-policy`, `scan:secrets`, and `contract` scripts; `contract` runs `node --import tsx --test src/be/api/test/openapi-parity.test.ts src/be/contracts/test/openapi.test.ts`. |
| Test | `tests/process-security/ci-workflow.test.ts` | Assert trigger, head SHA checkout, permissions, no `pull_request_target`, no secrets/environments, stable job names, and W1 dependency gating; cover E1, E2, E12, E15. |

**Checklist**

- [x] 1. Write failing workflow-shape tests for E1, E2, E12, and E15; expect failure because `.github/workflows/ci.yml` and the process-security commands do not exist.
- [x] 2. Add the workflow with independent jobs named `workspace`, `typecheck`, `lint`, `contract`, `dependency-audit`, `secret-scan`, and `workflow-security`; each job checks out `${{ github.event.pull_request.head.sha }}` with `fetch-depth: 0` and never receives secrets.
- [x] 3. Add the W1-dependent npm scripts, including `contract` with the exact `src/be` test paths and explicit Prisma generation before workspace tests; use `npm ci --ignore-scripts` before checks and never execute lifecycle scripts during install.
- [x] 4. Run the workflow-shape tests and the W1 workspace checks; expect PASS.
- [x] 5. Verify the same commit twice with identical runtime/action inputs and record the required-check names and outcomes; cover N1.
- [x] 6. Update branch state Progress and Changes.
- [x] 7. GATE: Mark the task complete in branch state and use the prescribed subject `feat: add isolated W12 pull request checks (W12)`.

### T2: Secret scanning and staged-file hook

**Delivers:** Gitleaks configuration, protected allowlist, CI tree/range scan, and a local staged-file hook. **Satisfies:** F5, F12, N3, E4, E5, E13, E14. **Depends on:** —. **Wave:** 1.

**Files**

| Action | Path | What changes |
|---|---|---|
| Create | `.gitleaks.toml` | Define the pinned Gitleaks `8.24.2` rules/configuration and narrow reviewed allowlist format. |
| Create | `.githooks/pre-commit` | Run `npm run scan:secrets -- --staged` and fail on a detected secret. |
| Create | `scripts/scan-secrets.mjs` | Implement staged and CI tree/`base_sha..head_sha` scan modes with redacted output and fail-closed range resolution. |
| Create | `scripts/setup-hooks.mjs` | Configure `core.hooksPath` to `.githooks` without writing credentials. |
| Create | `tests/process-security/secret-scan.test.ts` | Test canaries, renames, deleted/reintroduced secrets, narrow allowlists, and redacted output; cover E4, E5, E13, E14. |
| Modify | `package.json` | Add `setup:hooks` and `scan:secrets` scripts. |

**Checklist**

- [x] 1. Write failing scan tests for E4, E5, E13, and E14; expect failure because the scanner/configuration/hook do not exist.
- [x] 2. Add `.gitleaks.toml`, the staged-file hook, and the wrapper with explicit base/head range inputs and redacted output.
- [x] 3. Add `setup:hooks` and verify `--no-verify` cannot bypass the CI scan.
- [x] 4. Run the scanner tests and verify the full tree plus PR range are covered; expect PASS.
- [x] 5. Update branch state Progress and Changes.
- [x] 6. Record the task completion with subject `feat: enforce W12 secret scanning (W12)`.

### T3: Dependency audit and Action-pin verification

**Delivers:** Dependency audit evidence and a validator for approved immutable workflow inputs. **Satisfies:** F6, F7, N1, E6, E7, E13. **Depends on:** —. **Wave:** 1.

**Files**

| Action | Path | What changes |
|---|---|---|
| Create | `workflow/action-pins.json` | Record approved Action repositories, full SHA, source version, and action type for every third-party/local/reusable workflow input. |
| Create | `scripts/check-workflows.mjs` | Reject moving tags/branches, unapproved repositories, non-SHA references, remote bootstrap commands, unpinned images, and unapproved reusable/local actions. |
| Create | `tests/process-security/workflow-security.test.ts` | Test rejected action references, altered allowlists, remote execution, and job-level write permissions; cover E6, E7, E13. |
| Modify | `package.json` | Add `check:workflows` and pin the exact audit command used by `dependency-audit`. |

**Checklist**

- [x] 1. Write failing workflow-security tests for E6, E7, and E13; expect failure because the manifest and validator do not exist.
- [x] 2. Add the manifest schema and validator; require exact repository/SHA/version correspondence and reject unapproved executable supply-chain inputs.
- [x] 3. Configure `dependency-audit` as `npm audit --audit-level=high`, record the lockfile and advisory source, and fail closed on service failure; remediate the audited Next.js, Zod, and Prisma dependency chains.
- [x] 4. Run the validator and controlled audit fixtures; expect PASS.
- [x] 5. Update branch state Progress and Changes.
- [x] 6. Record the task completion with subject `feat: verify W12 dependency and action inputs (W12)`.

### T4: Agent policy and protected control paths

**Delivers:** The canonical fail-closed agent policy, validator, adapter mediation contract, and protected-path inventory. **Satisfies:** F8, F13, N2, N4, E8, E9. **Depends on:** —. **Wave:** 1.

**Files**

| Action | Path | What changes |
|---|---|---|
| Create | `workflow/agent-permissions.json` | Define explicit `allow`, `deny`, `review_required`, and `content_handling` rules with default deny. |
| Create | `workflow/tools/agent-policy.mjs` | Provide the provider-neutral mediation seam that evaluates policy before command, file, network, or secret access. |
| Create | `scripts/check-agent-policy.mjs` | Validate the policy schema and fail closed for missing/malformed rules, production access, protected-path writes, and instruction-like corpus handling. |
| Create | `tests/process-security/agent-policy.test.ts` | Exercise command, file, network, secret, production-host, protected-path, missing-policy, malformed-policy, and corpus-data cases; cover E8 and E9. |
| Modify | `workflow/agents/reviewer.md` | Define the provider-neutral security-reviewer output contract and protected-path review behavior; regenerate provider adapters afterward. |
| Modify | `workflow/config.json` | Register the policy validator and security-review evidence path without adding credentials. |

**Checklist**

- [x] 1. Write failing policy tests for E8 and E9; expect failure because the canonical policy and validator do not exist.
- [x] 2. Add the JSON policy with default-deny rules for production credentials/hosts, all access to `tests/security/attack-corpus/**`, and protected-path writes.
- [x] 3. Add the central adapter mediation contract and reviewer artifact format, bound to the PR head and requiring `@ludannnn` plus a different human owner.
- [x] 3a. Regenerate `.claude/agents/reviewer.md` and `.codex/agents/reviewer.md` from `workflow/agents/reviewer.md` using the repository adapter tooling; do not edit generated adapters directly.
- [x] 4. Run policy tests with missing, malformed, bypass, and instruction-like fixtures; expect PASS and no side effects.
- [x] 5. Update branch state Progress and Changes.
- [x] 6. Record the task completion with subject `feat: add W12 agent process policy (W12)`.

### T5: CODEOWNERS and branch protection

**Delivers:** Protected-path ownership and GitHub settings for `development` and `main`. **Satisfies:** F9, F10, N2, N4, E8, E10, E11. **Depends on:** T4, Q1 resolved. **Wave:** 2.

**Files**

| Action | Path | What changes |
|---|---|---|
| Create | `.github/CODEOWNERS` | Assign `@teleifo` to the canonical protected paths (`src/be/contracts/**`, `src/be/*/test/**`, and the process-security paths) and require independent security review by `@ludannnn` for security-sensitive paths. |
| Create | `tests/process-security/codeowners.test.ts` | Verify every protected path is covered and owner/reviewer entries are concrete; cover E8 and E10. |
| Modify | `workflow/project-state/branch-states/w12.md` | Record the GitHub settings evidence and any owner handoff. |

**Checklist**

- [x] 1. Write failing CODEOWNERS coverage tests for E8 and E10; expect failure because `.github/CODEOWNERS` does not exist.
- [x] 2. Add exact protected patterns for workflows, CODEOWNERS, package manifests/scripts, hooks, scanner config, agent files, workflow files, `src/be/contracts/**`, `src/be/*/test/**`, and security corpus; assert obsolete `packages/**` patterns are absent.
- [ ] 3. GATE: Ask the operator to apply and confirm GitHub rules on both `development` and `main`: seven required checks, one CODEOWNER approval, stale-approval dismissal, latest-push approval, no self-approval, no administrator bypass, no direct/force/deletion pushes, and up-to-date-branch enforcement.
- [ ] 4. GATE: After operator confirmation, capture the settings verification and negative direct/force-push, bypass, stale/self-approval results; expect PASS.
- [ ] 5. Update branch state Progress and Changes.
- [ ] 6. Record the task completion with subject `feat: protect W12 repository paths (W12)`.

### T6: Security evidence and final verification

**Delivers:** Head-bound security-review check, complete failure-case evidence, and closeout verification. **Satisfies:** F4, F5, F6, F7, F8, F9, F10, F11, F13, N1, N3, N4, E3, E5, E6, E7, E8, E9, E10, E11, E12, E13, E14. **Depends on:** T1, T2, T3, T4, T5. **Wave:** 3.

**Files**

| Action | Path | What changes |
|---|---|---|
| Create | `scripts/check-security-review.mjs` | Verify a fresh security-review artifact is present for the exact PR head, authored by the security reviewer, and paired with independent human approval for sensitive paths. |
| Create | `tests/process-security/security-review.test.ts` | Test missing, stale, self-authored, and valid review artifacts; cover F13 and E8–E10. |
| Modify | `.github/workflows/ci.yml` | Extend the existing `workflow-security` check with head-bound security-review evidence; do not add an eighth required status. |
| Modify | `workflow/project-state/branch-states/w12.md` | Record verification results, changes, and final handoff. |

**Checklist**

- [ ] 1. Write failing security-review tests for missing, stale, self-authored, and valid artifacts; expect failure because the checker does not exist.
- [ ] 2. Add the head-bound security-review checker and invoke it from the existing `workflow-security` check; fail closed when sensitive paths change without current evidence.
- [ ] 3. Run all E3–E14 fixtures and verify no secret canary appears in logs.
- [ ] 4. Run `npm test`, `npm run typecheck`, `npm run lint`, `npm --workspace @agile/db run prisma:validate`, `node .claude/skills/writing-specs-lite/scripts/lint.mjs spec workflow/specs/2026-11-02-w12-ci-process-security-design.md --approved`, `node .claude/skills/writing-specs-lite/scripts/lint.mjs plan workflow/plans/2026-11-02-w12-ci-process-security-plan.md --approved`, and `git diff --check`.
- [ ] 5. Update the plan, branch state, and Changes line; confirm the working tree is clean.
- [ ] 6. Record the task completion with subject `test: verify W12 process security controls (W12)`.

### Close-out

- [ ] Every Traceability row has passing evidence or a named manual verification.
- [ ] W1 dependency is merged into `development`; all W12 task statuses, spec status, and branch-state Progress agree with reality.
- [ ] The W12 branch state is set to `In review`, session rows are removed, and all Changes refs are complete.
- [ ] **GATE:** Ask the operator to review the completed W12 branch at Gate 3; do not push, open a PR, or merge before approval.
- [ ] **Handover:** After merge, ask the operator for Gate 4 `sync-project-state`; report the fold at Gate 5 and ask for Gate 6 developer-guide confirmation.
