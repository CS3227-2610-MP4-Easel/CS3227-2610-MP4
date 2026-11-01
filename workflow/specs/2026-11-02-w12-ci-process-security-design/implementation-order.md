# W12 Implementation Order

| Task | Outcome | Satisfies | Depends on | Can run concurrently with | Wave |
|---|---|---|---|---|---|
| T1 | Add the pull-request workflow with isolated permissions and stable required checks | F1, F2, F3, F4, F11, N1, N2, N3 | W1 merged into INT | T2, T3, T4 | 1 |
| T2 | Add the Gitleaks configuration, protected allowlist, and local staged-file hook | F5, F12, N3 | — | T1, T3, T4 | 1 |
| T3 | Add dependency audit and the approved Action-pin manifest/check | F6, F7, N1 | — | T1, T2, T4 | 1 |
| T4 | Add the canonical agent-permission policy, validator, and protected-path rules | F8, F13, N2, N4 | — | T1, T2, T3 | 1 |
| T5 | Add CODEOWNERS and record the protected-branch settings after Q1 is resolved | F9, F10, N2, N4 | T4, Q1 | — | 2 |
| T6 | Verify credential isolation, failure cases, cross-review evidence, and complete CI evidence | F11, F13, N1, N3 | T1, T2, T3, T4, T5 | — | 3 |

## Dependency notes

T1 is gated by W1 because it invokes the W1 workspace scripts and OpenAPI parity test. T2, T3,
and T4 touch independent control surfaces and can be authored concurrently, but the plan must
serialize edits if they share a workflow or documentation file. T5 depends on T4 and Q1 so the
protected paths and owners match the policy. T6 is the final verification task and must run against
the merged control surface.
