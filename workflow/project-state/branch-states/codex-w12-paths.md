# Branch State — codex/w12-paths

- **Branch:** codex/w12-paths
- **Base:** 3519ff077de611e79be28b1c3743a027675260c9
- **Owner:** Xiao-Congchen
- **Status:** Draft
- **Last updated:** 2026-11-11 by Codex
- **Untouched:** Architecture, Conventions

## How to Resume

The operator requested a separate PR for the W12 security fix interleaved in W7c. Extracted the hook, regression tests and approved spec from 122e83c; the base versions of both changed code files match its parent. Review the extracted diff and obtain Gate 3 approval before merge.

## Workstreams

| ID | Workstream | Status | Spec | Plan | Progress | Guide |
|---|---|---|---|---|---|---|
| W12-paths | Process-security external path classification | In review | [spec](../../specs/2026-11-11-process-security-paths-design.md) | Skipped by operator | Extracted from W7c; focused hook suite 19 passed | — |

## Changes

| Date | What changed | Workstream | Ref |
|---|---|---|---|
| 2026-11-11 | Extracted the approved literal external-path fix and regression tests; focused hook suite 19 passed, none skipped. | W12-paths | 122e83c |

## Decisions

The operator approved the narrowed security spec and directed implementation without a separate plan; security tests and review remained required. The original branch recorded this as C~7.

## Known Gaps

- **Shell working-directory assumption (Handover):** Relative paths are resolved against the Git root without an authoritative shell cwd; compound commands may change directory. Follow up with a cwd contract and tests.
- **Other shell-mediation limitations (Handover):** Command-script effects, shell expansion and symlink handling, and normalization of absolute protected write targets are not comprehensively handled. Absolute repository paths may miss root-relative protected-path matching. The literal-path fix does not close these gaps.
