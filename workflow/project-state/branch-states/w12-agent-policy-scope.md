# Branch State — w12-agent-policy-scope

**What this branch has changed, and how to pick it up.** `workflow/project-state/STATE.md`
describes `INT`; read it for context and write here instead of editing it.
`sync-project-state` folds this file in after the branch merges.

- **Branch:** w12-agent-policy-scope (from `INT` at `90e1e9c`)
- **Base:** 90e1e9c
- **Owner:** ludannnn (Developer member); W12 owner `@teleifo` reviews
- **Status:** Draft
- **Approved:** —
- **Last updated:** 2026-11-05 by Claude Opus 5.5 — agent policy narrowed

**Untouched:** Architecture, Known Gaps, Deviations

---

**Scope.** A W12 follow-up that narrows the agent pre-tool policy to what the W12 spec's F8 requires, so agents can do ordinary repository work again: commit, run `node` and `npm`, use pipes and `&&`, and write specs, plans and branch states. Production, secrets, push and the process-control files stay denied or review-required. Medium size: a scoped correction of an existing control; no contract, schema or application permission changes.

---

## 1. How to Resume

**Sessions**

| Session | Started | Agent(s) | Workstream | Status | Doing | Next action | Last touched |
|---|---|---|---|---|---|---|---|
| S1 | 2026-11-05 | Claude Opus 5.5 | W12 | Active | Narrowing the agent policy | Run `npm test`; commit; operator pushes and opens the PR | 2026-11-05 |

**Remaining**

- [ ] Full suite green with the new hook, policy and tests.
- [ ] GATE: operator pushes `w12-agent-policy-scope` and opens the PR into `development`. Sensitive paths: the author (`@ludannnn`) is excluded, so `@teleifo` and `@Xiao-Congchen` approve.
- [ ] After merge: merge `development` into `w2-gateway`.

---

## 2. Workstreams

| ID | Workstream | Status | Spec | Plan | Progress | Guide |
|---|---|---|---|---|---|---|
| W12 | CI and process security (follow-up) | Building | [W12 spec](../../specs/2026-11-02-w12-ci-process-security-design.md) F8 | — | Policy narrowed; tests updated | guide out of date: agent policy |

---

## 3. Changes

| Date | What changed | Workstream | Ref |
|---|---|---|---|
| 2026-11-05 | Agent policy narrowed (C~1): `workflow/agent-permissions.json` protects only the process-control files under `workflow/` instead of `workflow/**`; `workflow/tools/agent-policy.mjs` no longer refuses every shell write; `scripts/agent-pre-tool-hook.mjs` classifies each part of a compound command, allows repository writes by git, npm, node and file commands, and checks only the paths a command writes against the protected list; still denies `git push`, `npm publish`, `git commit --no-verify`, network tools, inline `node -e`, command substitution, writes outside the repository and commands naming secrets; `tests/process-security/` updated to the new rules | W12 | this commit |

---

## 5. Conventions

- **Agent policy scope:** agents may write the workflow's own outputs (`workflow/specs/`, `workflow/plans/`, `workflow/project-state/`, `workflow/skill-feedback.md`) and run git (except `push`), `node`, `npm` and file commands inside the repository. The process-control files (`workflow/agent-permissions.json`, `workflow/security-sensitive-paths.json`, `workflow/action-pins.json`, `workflow/tools/**`, `workflow/agents/**`, `workflow/skills/**`, `workflow/skills.lock`, `workflow/manifest.json`, `workflow/config.json`, `workflow/models.json`, `.github/**`, `.githooks/**`, `.claude/**`, `.codex/**`, `scripts/**`) and the attack corpus stay review-required. CODEOWNERS review on GitHub for every `workflow/**` path is unchanged and remains the merge-time control.

## 7. Decisions

> Legend: `C` = project decision. AD-nn entries are in docs/architecture.

### C~1 — Narrow the agent pre-tool policy to process-control files

- **Date:** 2026-11-05
- **Who asked:** operator (ludannnn, Developer member and W12's named security reviewer), after the hook from W12 (`bd1c5d2`, `724f3f2`) blocked `git add`/`commit`, `node`, pipes and every edit under `workflow/`, so agents could not update the branch states the workflow requires them to write
- **Supersedes:** the `workflow/**` entry in `workflow/agent-permissions.json` and the blanket shell-write refusal in `workflow/tools/agent-policy.mjs`. Neither is recorded as a W12 decision: spec F8 requires default-deny, denied production access and review for `.github/**`, the policy file, `.githooks/**` and the attack corpus; `bd1c5d2` states the hook should allow "ordinary repository work". This keeps every F8 requirement.
- **Why:** the project is an agentic workflow; an agent that cannot commit, run the workflow tool or write its own branch state cannot follow AGENTS.md § 2. The process-control files still need review, and CODEOWNERS still gates every `workflow/**` change at merge.
- **Rejected:** disabling the hook locally (sidesteps the team control); keeping the policy and having the operator run every git and copy step (slow and error-prone; it already caused a broken `~/.zshrc` and repeated copy steps).
