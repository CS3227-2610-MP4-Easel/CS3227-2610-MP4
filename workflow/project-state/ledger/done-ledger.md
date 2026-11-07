# Done Ledger — Agile Platform

The full chronological record of every change, newest first. One line each: what changed and why, with a commit, plan or artifact as the reference. Not a copy of `git log`.

| Date | What changed | Workstream | Ref |
|---|---|---|---|
| 2026-11-07 | Folded branch state `w12` | — | archive |
| 2026-11-05 | Implemented author-excluding trusted-pair approval mapping for all three trusted authors, updated config/contracts/tests, and passed 159-test verification | W12 | working-tree |
| 2026-11-05 | Re-reviewed current PR #9 at `6520e04`; found Action-pin bootstrap rejection against the post-PR #11 `development` base, excluding the known approval-only failure | W12 | review |
| 2026-11-05 | Rebound the one-time Action-pin bootstrap from the superseded base to current `development` SHA `68d639a067ce514085a8074b9f18fa0c3ab3ed06`; updated code, tests, spec, and plan; full verification passes | W12 | working-tree |
| 2026-11-05 | Fixed unusual Git pathname handling with NUL-delimited `git diff` records, newline-safe glob matching, and an E26 regression test; full verification passes with 157 tests and 1 expected skip | W12 | working-tree |
| 2026-11-05 | Reviewed PR #9 at `4046d97`; found one approval-gate bypass for quoted unusual Git pathnames, excluding the known approval-only failure | W12 | review |
| 2026-11-05 | Merged rollout PR #11 into `development`; updated PR #9 onto the new trusted base, and the trusted check now fails closed only for its missing exact-head approvals | W12 | PR #11 / PR #9 |
| 2026-11-05 | Implemented T7 test-first: trusted workflow is the sole `workflow-security` publisher, CLI base arguments bind correctly, rename paths are classified with `--no-renames`, and npm test discovery is shell-independent; full local verification passes | W12 | 63df36b |
| 2026-11-05 | Dev Lead confirmed the separate trusted review-event design and approved the amended T7 spec and plan at Gates 1 and 2 | W12 | approved |
| 2026-11-05 | Validated the five reported PR #9 findings against the cited head, local implementation, focused tests, and GitHub/Git documentation; all five are valid, with finding 4 clarified as configuration-sensitive but applicable under Git's default rename detection | W12 | review |
| 2026-11-04 | Updated PR #9 with the canonical sensitive-path list, dual exact-head approval rules, author-dependent approver mapping, stale-review behavior, and the non-sensitive PR distinction | W12 | PR #9 |
| 2026-11-04 | Closed the re-review blockers and follow-up classifier bypasses: apply-patch paths, control-plane paths, mutation flags, workflow shell forms, absolute/traversal Bash read paths, and unapproved npm workspace scripts now fail closed or require review; focused process-security suite passes 34 tests | W12 | d41d3ca |
| 2026-11-04 | Re-reviewed the committed fixes and found four remaining blockers: permissive arbitrary Bash classification, outside-repository and traversal path handling, self-modifiable hook controls, and incomplete local/remote shell workflow detection | W12 | working-tree |
| 2026-11-04 | Fixed the remote-bootstrap shell bypass and enforced agent mediation through Codex/Claude PreToolUse hooks; added regression coverage, regenerated adapters, and passed 140 tests (1 expected skip), typecheck, lint, Prisma validation, workflow/policy checks, dependency audit, and diff checks | W12 | working-tree |
| 2026-11-04 | Re-review found a remaining `/bin/bash` remote-bootstrap bypass and confirmed adapter mediation is advisory text without a runtime/tool hook; live PR #9 remains at the pre-fix head with six passing checks and approval-only workflow-security failure | W12 | pending |
| 2026-11-04 | Resolved the four PR #9 code findings: structural YAML workflow parsing and CI-topology enforcement, immutable policy-value validation, executable agent-policy mediation wired into adapters, and patched YAML dependency; full verification passes | W12 | pending |
| 2026-11-04 | Reviewed the live PR after push; excluded the two expected GitHub-approval failures and found three code-level process-security gaps, including a YAML-regex bypass; recorded lesson L2 | W12 | pending |
| 2026-11-04 | Hardened PR #9 workflow checks: only pull_request triggers are accepted, deployment triggers fail closed, and Action pins come from the trusted base or bounded bootstrap pins | W12 | pending |
| 2026-11-04 | Fixed PR #9 review findings: reject write-all/inline write permissions, privileged workflow triggers/runners/environments, and malformed review records; added regression coverage | W12 | pending |
| 2026-11-04 | Dev Lead approved the artifact-removal change at Gate 3; branch is ready to push | W12 | pending |
| 2026-11-04 | Removed the committed security-review artifact requirement; two current exact-head GitHub approvals are now sufficient; 124-test suite and all checks pass | W12 | pending |
| 2026-11-04 | Dev Lead approved the artifact-removal W12 implementation plan at Gate 2; T6 implementation may continue | W12 | pending |
| 2026-11-04 | Dev Lead approved the artifact-removal W12 specification at Gate 1; amended plan approval remains pending | W12 | pending |
| 2026-11-04 | Dev Lead requested removal of the committed security-review artifact; spec and plan amendment is in review and prior approvals are superseded | W12 | pending |
| 2026-11-04 | Dev Lead approved the W12 branch at Gate 3; updated PR #9 with bootstrap, verification, and review requirements | W12 | pending |
| 2026-11-04 | Verified 124 tests (123 passed, 1 expected skip), typecheck, lint, Prisma validation, security tests, workflow validation, approved spec/plan lint, and diff checks; T6 awaits GitHub rollout evidence | W12 | pending |
| 2026-11-04 | Added bootstrap identity guards, duplicate-key-aware manifest validation, head-manifest checks, workflow inputs, and regression tests; full local verification passes | W12 | pending |
| 2026-11-04 | Dev Lead approved the amended W12 implementation plan at Gate 2; T6 bootstrap implementation may begin | W12 | pending |
| 2026-11-04 | Dev Lead approved the amended W12 specification at Gate 1; implementation remains paused pending amended plan approval at Gate 2 | W12 | pending |
| 2026-11-04 | Bootstrap review fixes bind the fallback to `development` at base SHA `7bd65440023a0123ac92445e5b6e58ec838ee57c`, define the exact ordered list, validate head-manifest changes, and record post-merge bootstrap retirement | W12 | pending |
| 2026-11-04 | Dev Lead selected Option 2: amend T6 with a fixed first-rollout bootstrap list so W12 can merge once without directly seeding `development`; spec and plan amendment is in review | W12 | pending |
| 2026-11-04 | Implemented T6 dual exact-head GitHub review verification, paginated review retrieval, author-dependent approver mapping, generated adapters, and a non-backtracking workflow-permission validator; focused process-security checks pass | W12 | pending |
| 2026-11-04 | Added the canonical sensitive-path manifest, aligned CODEOWNERS with all three required owners, and passed the manifest/CODEOWNERS coverage test; T5 is complete and T6 starts | W12 | pending |
| 2026-11-04 | Dev Lead approved `@ludannnn` as the security reviewer and `@Xiao-Congchen` as the independent human approver for PRs authored by `@teleifo`; W12 spec amendment is in review | W12 | pending |
| 2026-11-04 | Dev Lead approved the amended W12 plan at Gate 2; T5 implementation starts | W12 | pending |
| 2026-11-04 | Amended the W12 implementation plan for the base-branch sensitive manifest, CODEOWNERS expansion, paginated GitHub review fetch, current-state algorithm, and E16–E20 tests; plan lint is clean | W12 | pending |
| 2026-11-04 | Amended the sensitive-path review contract to require current exact-head GitHub approvals from `@ludannnn` and the author-dependent human approver; canonical sensitive paths are now specified | W12 | pending |
| 2026-11-04 | Added head-bound security-review validation and wired it into the existing `workflow-security` check; tests cover missing, stale, self-authored, non-independent, valid, and non-sensitive cases | W12 | pending |
| 2026-11-04 | Implemented T6 head-bound security-review validation and passed the 118-test suite, typecheck, lint, schema, contract, workflow, policy, exact Gitleaks, dependency audit, and spec checks; plan lint exposed the recorded Create-row flow issue | W12 | edc5e6e |
| 2026-11-04 | Dev Lead applied GitHub protection; verified the seven required checks, strict status enforcement, code-owner review, stale/last-push review rules, admin enforcement, and disabled force pushes/deletions on both `development` and `main` | W12 | 7725177 |
| 2026-11-04 | Pushed the CI repairs; PR #9 run 41687413113 passed workspace, typecheck, lint, contract, dependency-audit, secret-scan, and workflow-security | W12 | fc1a2b6 |
| 2026-11-04 | Repaired the remaining PR-only failures: replaced the historical secret-like test canary with a safe fixture, added an exact fingerprint ignore for that reviewed historical false positive, and made `npm test` discover files on Node 20; protected the ignore file with CODEOWNERS | W12 | a93656e |
| 2026-11-04 | Repaired PR CI clean-install prerequisites: placeholder `DATABASE_URL`, explicit Prisma generation, and checksum-pinned Gitleaks installation; local checks pass and the PR is ready to rerun | W12 | 0de6312 |
| 2026-11-04 | Added CODEOWNERS coverage for all W12 protected paths and independent security review paths; T5 now awaits GitHub settings confirmation | W12 | 634279d |
| 2026-11-04 | Added default-deny agent policy, fail-closed mediation validator, security-review contract, process-security config, and regenerated Claude/Codex reviewer adapters; T4 checks pass | W12 | 86108d3 |
| 2026-11-04 | Started T4 agent policy and protected control paths; next step is failing policy tests before implementation | W12 | 86108d3 |
| 2026-11-04 | Remediated audited Next.js, Zod, and Prisma chains; added Prisma 7 config/adapter compatibility and passed 108 tests, typecheck, lint, contracts, schema validation, audit, workflow validation, and diff checks | W12 | 1832d22 |
| 2026-11-04 | Dev Lead approved smallest compatible dependency upgrades first, with a Prisma major upgrade allowed only if required to clear the audit | W12 | 1832d22 |
| 2026-11-03 | Added immutable Action manifest/validator and exact dependency-audit command; audit found 7 high/critical vulnerabilities | W12 | 3ce9c01 |
| 2026-11-03 | Added Gitleaks configuration, staged pre-commit scanning, redacted range scanning, and hook setup | W12 | 4d8025d |
| 2026-11-03 | T1 verification passed: 102 tests, typecheck, lint, Prisma validation, contract tests, and repeated workflow-shape checks on one commit | W12 | 761d4b7 |
| 2026-11-03 | Added the isolated seven-job pull-request workflow, contract command, and workflow-shape tests | W12 | 761d4b7 |
| 2026-11-03 | Repaired clean-install Prisma generation and verified the full W1 baseline | W12 | 7edeca0 |
| 2026-11-03 | Gate 2 approved; baseline verification stopped before T1 because typecheck/lint and Prisma validation were not green | W12 | 25a5b21 |
| 2026-11-03 | Reconciled W12 protected paths and contract-test locations with W1's `src/be` source root; plan lint is clean with one expected future-test warning | W12 | 43232af |
| 2026-11-03 | Merged the current INT tip containing W1 into w12; package and source-root paths are now available for plan validation | W12 | 5019109 |
| 2026-11-02 | W12 implementation plan drafted; validation is blocked until W1 supplies `package.json` | W12 | 83c0c48 |
| 2026-11-02 | Dev Lead approved the W12 spec at Gate 1 | W12 | fd0bf26 |
| 2026-11-02 | Dev Lead assigned `@teleifo` as repository/CODEOWNERS owner and `@ludannnn` as independent security reviewer | W12 | 6fa8493 |
| 2026-11-02 | High-risk spec drafted, linted, and reviewed twice | W12 | a4ba0db |
| 2026-11-02 | Dev Lead selected Option 1: a thin enforceable CI and process-security baseline | W12 | a38afa6 |
| 2026-11-02 | Started W12 from the current INT base; classified repository permissions and CI security as Big/high-risk work | W12 | a38afa6 |
| 2026-11-05 | Dev Lead requested one review per PR; removed dual-review status requirement on development and main, and removed obsolete CI enforcement locally | W12 | working-tree |
| 2026-11-05 | Dev Lead accepted review-gate bypass risk for the small team and directed direct implementation without a plan; fixed Windows workflow-checker entry point | W12 | working-tree |
| 2026-11-05 | Dev Lead requested trusted-gate amendment; drafted security requirements and identified publisher provenance and review-event trust gaps | W12 | working-tree |
| 2026-11-05 | Rebound Action-pin bootstrap to current development base 637d09f; focused test and workflow validation passed | W12 | working-tree |
| 2026-11-07 | Folded branch state `w2-gateway` | — | archive |
| 2026-11-05 | W2 spec drafted (7 F, 5 N, T1 to T7) and reviewed by four lenses: 5 blocking findings fixed (row written before its columns exist, fit failures leaving rows, static-section rule conflict, no clock seam, breaker race unstated); the spend cap reworked to keep AD-64's decaying budget block; the key restricted to the SoCLaaS host; 47 edge cases; lint clean | W2 | a40f7f8 |
| 2026-11-05 | Spec approved at Gate 1 by the operator | W2 | efdb802 |
| 2026-11-05 | Merged `development` (W4 PR #10, W12 PR #9) into the branch | W2 | dc55769 |
| 2026-11-05 | Plan written (T1 to T7, close-out), reviewed (Implementer lens: no blocking, 9 minor, all fixed), updated after merging `development` (W4 merged, Prisma 7 adapter, test runner through `tests/setup-auth-env.ts`, W12 agent policy) and approved at Gate 2 | W2 | c37ff6e |
| 2026-11-05 | T1: `loadGatewaySettings` (tier rules, exact SoCLaaS URL, model overrides), `config.ts` (features, models, limits), token estimate, cost and reservation, section fitting, `assertStaticSectionsFit`, fake clock; `tests/setup-auth-env.ts` defaults `LLM_MODE=mock` and blocks requests to SoCLaaS; 246 tests, 245 pass, 1 fails (D5), none skipped | W2 | b55aeed |
| 2026-11-05 | T2: `isInTransaction()` in `@agile/db` (new `transaction-scope.ts`, an `AsyncLocalStorage` entered by `inCoreTransaction`, `inMutationTransaction` and the filtered client's callback `$transaction`); W1 files, for the Dev Lead to review (SD6); 248 tests, 247 pass, 1 fails (D5), none skipped | W2 | c85f739 |
| 2026-11-05 | T3: `providers.ts`: `LlmProvider`, `UpstreamError` (kind and status only), the process-wide mock registry (`registerMockResponse`, `hasMockResponse`), `createMockProvider` (estimated tokens, foreign errors become `MOCK_RESPONSE_FAILED`), `createSoclaasProvider` (key only to the pinned URL, `redirect: "error"`, abort timeout); 253 tests, 252 pass, 1 fails (D5), none skipped | W2 | 648ddf5 |
| 2026-11-05 | T4: `createSessions` (open with idle abandonment, Singapore-day and open-per-feature caps, `assertUsable`, `touch`, idempotent `close`, conditional `regenerate`) and `SessionCapReached`; all times from the injected clock, all queries limited to the tier's `env`; 6 integration tests on Postgres; 259 tests, 258 pass, 1 fails (D5), none skipped | W2 | 7c7a338 |
| 2026-11-05 | T5: `limits.ts`: `checkBudget` (AD-64 decaying block in `llm_gateway_state`, UTC-day sum including in-flight reservations and failed calls, 15 minutes or UTC midnight) and `checkWindows` (four AD-59 windows over `auth`'s `hit`, stopping at the first refusal); 2 integration and 4 unit tests; 265 tests, 261 pass, 4 fail (D5 and three old W12 hook tests failing only against the uncommitted new hook), none skipped | W2 | 85ed506 |
| 2026-11-05 | T6: `createLlmGateway` (`run`: ten admission steps in spec order, lease sweep, input guard, fit, `IN_FLIGHT` row with a cost reservation, one retry within the 25 s deadline, output guard, guarded finalise, session touch, breaker), `guards.ts` (default guards), `breaker.ts`, `runtime.ts` (`getLlmGateway`, `getSessions`); 20 service tests over in-memory fakes and 5 integration tests including the E25 leak check across seven statuses; 291 tests, 287 pass, 4 fail (D5 and the three old W12 hook tests, as at T5), none skipped | W2 | 6f1cb13 |
| 2026-11-05 | T7: `usage.ts`: `usageSessions` (caller's sessions in this tier, `[from, to)`, newest first, per-session call sums, paging with `RangeError` on bad page or size), `usageSummary` (per feature and model, no user data, means rounded to 2 decimals), `failureReason` (owner-only `UPSTREAM_LIMIT`); both usage queries take the tier as an argument; 3 integration tests; 294 tests, 290 pass, 4 fail (same as T5), none skipped | W2 | ae5ec76 |
| 2026-11-05 | Close-out: Attacker and Tester lenses on the branch diff, no blocking findings. Fixed: the SoCLaaS timeout now covers the response body, bodies over 1 MB and absurd token counts are refused; a throw after the row is written finalises it `UPSTREAM_ERROR` and leaves only `LLM_CALL_FAILED`; internal (non-upstream) errors no longer count towards the breaker (D7); the budget sum gets an upper bound on the UTC day (a real bug: later-dated rows counted, which also let parallel test files block each other); the gateway's settings no longer carry the key; usage queries refuse invalid dates and pages over 10,000; tests added for timeouts and network failures counting, early-retry timeouts, static over budget at `run`, model override and reasoning effort, live mode without a mock, exact `maxChars`, the Singapore-day edge, `from` inclusive, a lease ending exactly now, and E22 with an isolated breaker row; E25 gained five admission paths. 301 tests, 297 pass, 4 fail (same as T5), none skipped, run twice | W2 | 26ec4f8 |
| 2026-11-06 | Merged `development` (W12 agent policy PR #13) into the branch after discarding the uncommitted policy copies; 305 tests, 304 pass, 1 fails (D5), none skipped | W2 | e568668 |
| 2026-11-06 | PR #14 opened into `development` | W2 | PR #14 |
| 2026-11-06 | PR #14 review fix: `usageSessions` sums only this tier's calls, and `failureReason` takes the tier and ignores another tier's call (D6); tests cover a `dev` call on a `test` session and a `dev` lookup; 305 tests, 304 pass, 1 fails (D5), none skipped | W2 | PR #14 |
| 2026-11-06 | PR #14 review (must fix): after a call's row is finalised, a failed session touch or breaker write no longer throws `LLM_CALL_FAILED`; it logs `llm_call_followup_failed` with `callId` and status and returns the answer that matches the row, so a paid, recorded `OK` is never reported as a failure. Cost: one idle-clock refresh or one breaker count can be lost. Regression test fails on the old code; 306 tests, 305 pass, 1 fails (D5), none skipped | W2 | e644f02 |
| 2026-11-06 | PR #14 review (should fix): W1's `visibility-integration.test.ts` uses the `PrismaPg` adapter (Prisma 7 removed `datasourceUrl`), reversing the D5 choice (C29); CI Postgres handed to W12. 306 tests, 306 pass, none skipped | W2 | this commit |
| 2026-11-03 | Developer guide checkpoint documented W1 source-root, contracts, filtered DB, API registration, testing, and handover seams | W1 | `docs/guide/` |
| 2026-11-03 | Folded branch state `w1` | — | archive |
| 2026-11-03 | Resolved follow-up blockers: Next extension resolution, runtime/type raw-SQL boundary, numeric/array/date/enum OpenAPI fidelity, and trailing blank lines; 71 tests, typechecks, Prisma validation, production build, and diff checks pass | W1 | 41d062a |
| 2026-11-03 | Follow-up audit confirmed four remaining blockers: frontend production import resolution, runtime raw-SQL exposure, incomplete Zod-to-OpenAPI constraints, and trailing blank lines; fixes started | W1 | S11; PR #5 follow-up |
| 2026-11-03 | Audited both PR #5 review rounds; extended nested sanitization to `findFirstOrThrow` and replaced the remaining non-empty OpenAPI placeholders for task events and lead standup pages; full verification remains green | W1 | 27bc37b |
| 2026-11-03 | Implemented all six review fixes: relation-aware visibility, recursive nested sanitization, archived-write authorization ordering, compound selectors, concrete OpenAPI schemas, and the Next health adapter; 70 tests, typechecks, lint, Prisma validation, and diff checks pass | W1 | 27bc37b |
| 2026-11-03 | Operator reversed the frontend boundary only for the minimal health-route adapter; review-fix implementation resumed | W1 | C26; S10 |
| 2026-11-03 | New review identified five backend visibility/auth/selector/OpenAPI fixes plus a missing Next health adapter; implementation paused because the adapter conflicts with C23/C24 | W1 | S10; human decision required |
| 2026-11-03 | Operator approved the source-root migration branch at Gate 3 | W1 | review approval |
| 2026-11-03 | T5 close-out complete: traceability evidence, final verification, diff review, and closeout lint pass; source-root branch is ready for Gate 3 | W1 | plan T5 |
| 2026-11-03 | T4 complete: integrated layout, package-link, PR #6 ownership, full test, typecheck, Prisma, diff, and plan verification pass; removed one ignored stale build artifact under deleted `apps/web` | W1 | plan T4 |
| 2026-11-03 | T3 complete: migrated workspace/import/recovery tests, guide and normative path references, and guardrails; 66 tests, typechecks, Prisma validation, and plan lint pass | W1 | plan T3 |
| 2026-11-02 | T2 verification recorded: Prisma validation passed with `DATABASE_URL`; full tests intentionally deferred to T3 because three existing assertions still use old paths | W1 | plan T2 evidence |
| 2026-11-02 | T2 complete: regenerated workspace lockfile, rewired backend TypeScript references and Prisma path, updated ignore rules, and verified backend plus frontend typechecks | W1 | plan T2 |
| 2026-11-02 | T2 configuration rewiring started; root workspace includes `src/fe` and `src/be/*`, backend references use the new depth, and frontend typecheck remains standalone per PR #6 ownership | W1 | C25; plan T2 |
| 2026-11-02 | Operator authorized getting `w10-ui-mockups` locally and merging it into `w1` to satisfy H~1 | W1 | merge prerequisite |
| 2026-11-02 | Operator approved the source-root migration plan at Gate 2; execution stopped because `src/fe` is absent from the checkout | W1 | H~1 pending |
| 2026-11-02 | T1 complete: moved four backend packages under `src/be` and removed obsolete `apps/web`; `src/fe` untouched | W1 | plan T1 |
| 2026-11-02 | Fetched `origin/development` at `03d91d2` and merged it into `w1`; PR #6 frontend tree is present | W1 | merge commit |
| 2026-11-02 | Drafted source-root migration plan with five serialized tasks; plan lint clean | W1 | Gate 2 pending |
| 2026-11-02 | Operator approved the backend source-root spec at Gate 1 | W1 | spec approved; plan in progress |
| 2026-11-02 | Amended source-root spec for `src/fe` + `src/be/*`, direct `apps/web` deletion, exact shared-root updates, and PR #6 prerequisite; spec lint clean | W1 | C24; Gate 1 pending |
| 2026-11-02 | Operator directed removal of obsolete `apps/web`; source-root design now depends on PR #6's `src/fe` being present for verification | W1 | C24 |
| 2026-11-02 | Amended backend source-root spec for option 2 with exact commands, file inventory, entrypoint matrix, recovery behavior, and PR #6 handover; spec lint clean | W1 | C23; Gate 1 pending |
| 2026-11-02 | Operator selected option 2; W1 scope narrowed to backend relocation only, with frontend/backend integration deferred to PR #6 handover | W1 | C23 |
| 2026-11-02 | Second-round reviews found PR #6 `src/fe` is standalone and incompatible with the assumed `@agile/web` integration; implementation paused for ownership decision | W1 | Q12 pending |
| 2026-11-02 | Second-round Implementer review of backend source-root spec completed; lint clean; remaining findings concern transitional TypeScript ownership/path, exact Prisma command, file inventory, and package-entrypoint matrix | W1 | review report in chat |
| 2026-11-02 | Drafted backend source-root migration spec; no frontend or runtime contract changes included | W1 | Q12; spec pending Gate 1 |
| 2026-11-02 | Operator clarified the source-root split: PR #6 owns `src/fe`; this branch proposes backend packages under `src/be` | W1 | C22; A~2 |
| 2026-11-02 | PR #6 handover point 1 inspected; implementation paused because it conflicts with AD-01a/b and the recorded monorepo layout | W1 | Q12 pending |
| 2026-11-02 | T5 close-out verification complete: 66 tests pass, typecheck and approved spec/plan lint pass, diff review clean; Gate 3 pending | W1 | 024e632 |
| 2026-11-02 | T4 reconciled endpoint 6/42/36, standup-date rules, and normative architecture docs with PR #6; targeted tests and typecheck green | W1 | 9ab629b |
| 2026-11-02 | T3 OpenAPI schema registry, component emission, and recursive ref parity completed; targeted contract/API tests and typecheck green | W1 | 4075c0b |
| 2026-11-02 | T2 recursive visibility, compound selector normalization, and mutation recheck seam completed; targeted DB/API tests and typecheck green | W1 | fe1b1b7 |
| 2026-11-02 | T1 typed authorization resolution completed; targeted API tests and typecheck green | W1 | bd81bc3 |
| 2026-11-02 | Dev Lead approved the review-repairs implementation plan at Gate 2; T1 started | W1 | review-repairs plan |
| 2026-11-02 | Review-repairs design approved at Gate 1; plan drafted and both spec and plan lint clean; implementation is paused for Gate 2 | W1 | review-repairs design and plan |
| 2026-11-02 | Maintainer high-risk review of amended review-repairs design found material ownership, resolver-shape, normative-source, OpenAPI-mapping, and visibility-metadata gaps | W1 | review report in chat |
| 2026-11-02 | Tester/QA high-risk review of amended review-repairs design found blocking gaps in requirement-to-test traceability, normative PR #6 source reconciliation, recursive visibility/resource matrix coverage, OpenAPI failure observability, and race/date boundary evidence | W1 | review report in chat |
| 2026-11-02 | Attacker high-risk review of amended review-repairs design found three blocking gaps: archived-write error semantics, unspecified authorization/use race isolation, and missing root-project visibility coverage | W1 | review report in chat |
| 2026-11-02 | Implementer high-risk review of amended review-repairs design found blocking gaps in resolver outputs/transaction handoff, recursive visibility contract, OpenAPI registry typing, normative endpoint-42 reconciliation, and standup-date boundary semantics | W1 | review report in chat |
| 2026-11-02 | Operator reversed C20 for endpoint 42 and adopted PR #6 behavior; review-repairs design amended with explicit resolver, visibility, OpenAPI, date, and race semantics | W1 | C21; spec amendment |
| 2026-11-02 | Two review rounds completed; amended review-repairs design now has explicit resolver types/ownership, visibility registry, OpenAPI mapping/failure rules, endpoint-42 doc parity, date truth table, and race oracle; spec lint passes | W1 | review-repairs design |
| 2026-11-02 | Implementer high-risk review of amended repair bundle completed; blocking/material findings returned for resolver interface, recursive DB contract, OpenAPI registry, transaction seam, normative file scope, and date semantics | W1 | review report in chat |
| 2026-11-02 | Attacker high-risk review found authorization, tenancy, malformed-input, bypass, and consistency gaps; spec lint still passes | W1 | review report in chat |
| 2026-11-02 | Tester/QA high-risk review found one normative contract conflict and coverage gaps in resource resolution, recursive visibility, unique reads, OpenAPI failure behavior, and standup date boundaries | W1 | review report in chat |
| 2026-11-02 | Implementer/high-risk review found blocking gaps in resolver, visibility, OpenAPI, contract reconciliation, and date seams; spec lint passes | W1 | review report in chat |
| 2026-11-02 | Maintainer/high-risk review found four blocking maintainability findings; spec lint still passes | W1 | review report in chat |
| 2026-11-02 | Operator selected approach 1: repair existing authorization, DB visibility, OpenAPI, and contract seams in place | W1 | approach decision |
| 2026-11-02 | Dev Lead approved the repaired W1 branch at fresh Gate 3 | W1 | 7eb8392 |
| 2026-11-02 | Final read-only review passed with no Critical or Important findings; post-commit verification is green | W1 | ab69775 |
| 2026-11-02 | T9 repaired normative schemas, stable operation IDs, OpenAPI schema/status emission and parity, Prisma read extension, package entrypoints, consumer fixtures, and generated-artifact ignore coverage | W1 | ab69775 |
| 2026-11-02 | Late read-only review found filtered-client, contract-schema, package-export, OpenAPI-parity, policy-ID, and consumer-fixture gaps; W1 is reopened for fixes | W1 | review follow-up |
| 2026-11-02 | Dev Lead approved W1 at Gate 3 after closeout verification | W1 | 462bdb3 |
| 2026-11-02 | T8 frozen-first consumer fixtures and full verification completed; W1 ready for Gate 3 | W1 | 462bdb3 |
| 2026-11-02 | T7 OpenAPI parity, import-boundary, raw-query, collision, and project-scope verification completed; tests and typecheck green | W1 | db82d3a |
| 2026-11-02 | T6 Hono API boundary, health route, request-id, auth seam, input validation, and redaction completed; tests and typecheck green | W1 | 5507538 |
| 2026-11-02 | T5 initial migration, partial-index SQL parity, compatibility checks, and recovery procedure completed; tests and typecheck green | W1 | 35c1742 |
| 2026-11-02 | T4 Prisma schema, filtered client, project boundaries, and version seam completed; validation, tests, and typecheck green | W1 | ddbc25e |
| 2026-11-02 | T3 57-entry policy map and collision-safe route registration completed; tests and typecheck green | W1 | 5b697c8 |
| 2026-11-02 | T2 shared schemas, errors, pagination, and frozen-first interfaces completed; tests and typecheck green | W1 | 028272a |
| 2026-11-02 | T1 workspace scaffold, package boundaries, scripts, and typecheck baseline completed | W1 | f3340db |
| 2026-11-02 | Dev Lead approved the W1 implementation plan at Gate 2 | W1 | d6e6f0d |
| 2026-11-02 | Dev Lead approved the W1 spec at Gate 1 | W1 | c1aa20f |
| 2026-11-02 | W1 foundation spec drafted using normative architecture contracts; lint passes | W1 | c1aa20f |
| 2026-11-03 | Fixed filtered reads, nested visibility and raw SQL access; 79 tests including PostgreSQL integration, typecheck and lint pass | W1 | 8f649c4 |
| 2026-11-03 | Fixed paginated OpenAPI response shapes and path parameters; independent OpenAPI validation passes | W1 | b86b89a |
| 2026-11-03 | Added redaction cycle handling, JSON 404s, and missing visibility policy detection; remaining review fixes pending | W1 | 324b048 |
| 2026-11-03 | Mapped DB domain errors, made maintenance stub fail, and forwarded HEAD/OPTIONS; targeted tests and typecheck pass | W1 | 324b048 |
| 2026-11-03 | Added authorization rollback, scoped principals, bounded transaction retries, and transaction callback typing; 84 tests pass, one skipped | W1 | d3599e7 |
| 2026-11-03 | Added write filtering, fail-closed model delegates, transaction ownership, 500 logging and package import; 87 tests pass, one DB integration skipped; production build fails with duplicate React | W1 | d3599e7 |
| 2026-11-03 | Aligned workspace React and verified production build; database integration remains environment-dependent | W1 | 6ccc3e4 |
| 2026-11-03 | Review follow-up: added `registerRoute` (policy gate, authorize, parse, commit/rollback) with a shared `ROUTES` list that `createApiApp` registers; `ApiContext` gains `input`; MEMBER operations whose resolver returns no project now 404; 100 tests pass against PostgreSQL 16, typecheck passes. Authorization runs before input parsing, so resolvers see `body: undefined` | W1 | this commit |
| 2026-11-03 | Added `createPredicateEvaluator(requireMember)` implementing NONE, MEMBER, MEMBER_PROJECTS, SELF, ASSIGNEE, MEMBER_OR_ASSIGNEE and ADDER per the spec's fixed semantics; 100 tests pass against PostgreSQL | W1 | this commit |
| 2026-11-03 | Independent review of PR #5 against a real PostgreSQL 16: 88/88 tests pass and the filtered client behaves correctly on compound keys, soft-delete and archived hiding, `_count`, aggregates and writes; found no registration glue, a fail-open null project, and three smaller leaks (Known Gaps) | W1 | review report in chat |
| 2026-11-02 | Developer guide first write: W10 front end (overview, setup, architecture, components, flow rules, testing) | W10 | `docs/guide/` |
| 2026-11-02 | Folded branch state `w10-ui-mockups` | — | archive |
| 2026-11-02 | Spec approved by the operator (gate 1); Q9 closed as SD13, Q10 as SD12 | W10 | this commit |
| 2026-11-02 | Web app location reversed to `src/fe` (C8); ui.md updated | W10 | this commit |
| 2026-11-02 | Prototype plan written and approved (gate 2); link check added at the operator's request | W10 | this commit |
| 2026-11-02 | T9 verified: `npm run lint` (no fixtures/store import outside `lib/api`), `npm run typecheck`, `npm run build`, `npm run smoke` (pm 37, lead 35, dev 27 routes return 200) and `linkcheck` (no dead link, every screen reached for all three roles) all pass. Hex colours appear only in `app/canvas.css` (tokens) and the Styleguide swatch page. Canvas comparison: the CSS is reused verbatim and the Standups page was checked at 1024 px; the side-by-side of every screen at 1280 and 1024 px was done manually by the operator and passed (2026-11-02) | W10 | this commit |
| 2026-11-02 | `src/fe` prototype: 73 canvas pages converted to React, routed by the spec URLs with a role cookie, every control wired to its screen; `linkcheck` passes for all three roles (no dead link, every screen reached). Not yet behind a data layer (T9b) | W10 | this commit |
| 2026-11-02 | Data layer `src/fe/lib/api` (typed fixtures, one function per endpoint number, in-memory store kept in sessionStorage). Board, sprints (start, close with carry-over, delete), members (add, remove with open-task refusal), checkpoints (add), standup (edit, accept, regenerate, copy, retry, example download), health (refresh, apply, dismiss), task status and blocked, archive project now work through it; toasts report each result | W10 | this commit |
| 2026-11-02 | Epics and task creation added to the data layer; backlog (all roles), add task and epic forms, new sprint form (overlap check), My work and the Projects list (New project for the PM only) now read and write through it | W10 | this commit |
| 2026-11-02 | Task drawer (edit, delete, status, block) and the three project overviews (progress, velocity, checkpoints, team) read through the data layer; task links carry the task id | W10 | this commit |
| 2026-11-01 | Spec index, edge cases and implementation order written; the screen files split so each stays under 200 lines (`screens-project.md`, `endpoint-coverage.md` added). `lint.mjs spec` passes. Implementer lens run, Tester skipped (C6) | W10 | 3aab4d6 |
| 2026-11-01 | All 20 screens, a global-states sheet, the close-sprint and plan-approve dialogs and shared shell components drawn on a design canvas (outside the repo); not visually verified | W10 | canvas link in Remaining |
| 2026-11-01 | Role variants, dialogs, states and shared components added to the canvas; spec updated for C9 to C15 (ui.md, edge-cases.md E11 and E48, screens-shared, screens-project, screens-dev, flows) | W10 | this commit |
| 2026-11-01 | Left nav removed; top-bar project switcher with All projects; full-width pages (C14; ui.md, edge-cases E45) | W10 | this commit |
| 2026-11-01 | PM Backlog and Checkpoints boards added; Plan tab moved before Checkpoints (C13; ui.md §3) | W10 | this commit |
| 2026-11-01 | Draft UI reference: shell and navigation, 20 screens with contents, interactions and states, and end-to-end flows per role | W10 | 4cd429a |
| 2026-10-31 | Workspace configured: state tree, AGENTS.md, vendored skills, role files and adapters; architecture decisions renamed AD-nn | — | `workflow-setup` |
| 2026-10-29 | Delivery plan, scope cut (AD-68), freeze (AD-69), deploy day (AD-70), UI scope (AD-71) and work split (AD-72) decided | — | `docs/architecture/delivery-plan.md` |
| 2026-10-29 | Architecture readiness gate passed for the first implementation slice | — | `docs/architecture/agile-platform-architecture.md` |

**Rotated:** none yet.
