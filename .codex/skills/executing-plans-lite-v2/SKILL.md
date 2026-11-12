---
name: executing-plans-lite-v2
description: Use when implementing a plan written with writing-plans-lite-v2 (a plan folder with plan.md and tasks/Tn.md). You act as the ORCHESTRATOR - read plan.md, decide order, bundling, parallelism and review level, dispatch implementer subagents that read only their own task file, pass JSON handovers between them, and keep the branch state current. Default since v2; v1 (executing-plans-lite) is retained for audit only.
---

# Executing Plans (lite, v2): the orchestrator

You do not write the code. You read `plan.md`, dispatch subagents that each read **one task file**,
carry handovers between them, decide when a review is worth its cost, and keep the record current. You
are the **only writer** of `plan.md` Status, the branch state and the session row (one row per
orchestrator, not per subagent). If you die, a replacement reads the same files and continues.

**Announce at start:** "I'm using executing-plans-lite-v2 to orchestrate the plan."

`<BUILD>` means the build commands in plan.md's Shared context. With several components, the baseline,
each wave and the close-out run **all** of them (through `ws test`).

**Medium change.** The spec file is the plan. Dispatch one implementer with the whole file as its task
file, apply the review rule below, then go to Close-out. No handover files are needed.

## Preconditions (stop if any fails)

- `lint.mjs plan <plan.md> --approved` passes; spec and plan are Approved. You are on a feature
  branch, never `INT` or the release branch.
- You read `STATE.md`, `guardrails.md`, the branch state (`branch-state` skill) and `plan.md`, and
  nothing else yet. Add your session row (Doing: orchestrating <plan>; Next: first ready task).
- `lint.mjs plan` shows no errors, the working tree is clean and `<BUILD>` is green (record the
  baseline; a red start is not yours to hide).

## Who reads what

| Role | Reads | Never reads |
|---|---|---|
| Orchestrator (you) | `STATE.md`, `guardrails.md`, branch state, `plan.md`, handovers (summary fields) | task files (only to dispatch by path), the spec, source code |
| Implementer | its task file, the Shared context you paste, its dependencies' handovers you paste | `STATE.md`, `guardrails.md`, branch state, the spec, other task files |
| Reviewer | the task file, the task's diff, nothing else | state files, the spec |

This is the exception to `AGENTS.md` § 7 for subagents you dispatch: they read what the brief names.
The task file already carries the rules that apply, so they have no need of the state files.

## The loop

1. **Find ready tasks.** Status is `Not started` and every dependency is `Done`. Never dispatch a task
   whose dependencies are not `Done`. A task `In progress (<other session>)` is another orchestrator's:
   leave it.
2. **Form dispatch units** from the ready set, using only `plan.md`:
   - **Single**: one task, one subagent (default for `standard` and `complex`).
   - **Bundle**: trivial tasks the plan allows to share an agent (a `Bundle:` note, or adjacent
     independent trivial tasks, at most 3 tasks and ~6 files, review `none` for all). One subagent,
     done in order, each with its own handover and commit.
   - **Parallel set**: concurrent tasks in the same wave sharing no files. Each subagent gets
     `isolation: worktree`; if worktrees are unavailable, run them one after another instead.
3. **Claim.** Set each task `In progress (<session>)` in plan.md and update your session row (task
   IDs, wave). Do not commit yet.
4. **Dispatch** each unit with the brief below, using the `implementer` agent. Never put task content
   in the brief that is not in the task file.
5. **Receive the report** (the handover JSON, see Handover). Validate it:
   `node .claude/skills/writing-specs-lite-v2/scripts/lint.mjs handover handovers/Tn.json --task Tn`.
   Then act on `status`:
   - `done`: go to step 6.
   - `blocked` or `partial`: read `blocked_reason` and `deviations`; apply "When reality diverges".
   - A `GATE:` step reached: set your session row to `Blocked - needs human`, ask the operator the
     question, and on a yes send the same subagent the go-ahead (or dispatch a fresh one starting at that step).
6. **Decide the review** (below). Dispatch reviewers if the level is above `none`; loop fixes through
   the implementer (maximum two rounds, then record a Deviation and ask).
7. **Record.** Set the task `Done`; update the branch state's Progress (position, about 15 words) and
   add a Changes line; carry the handover into the next briefs. In a parallel set, merge the worktree
   branches in task order, resolve conflicts, and run `<BUILD>` after each merge.
8. **Wave check** after the last task of a wave: `<BUILD>` for every component, `lint.mjs plan`, then
   **commit the state** (plan.md, handovers, branch state) as `docs: state after wave N (workstream)`.
   Also commit state whenever you pause, block, or hand over.
9. Repeat until every task is `Done` or `Post-merge`, then Close-out.

## The brief (fixed format)

```
Task file: <absolute path to tasks/Tn.md>   (read it fully; read nothing in the state or spec folders)

Shared context:
<paste plan.md "## Shared context" verbatim>

Handovers from tasks you depend on:
<for each dependency: its JSON "produces" and "next" and any "deviations", nothing else; or "none">

Do exactly the task. Run the Expected state checks first. When finished, write handovers/Tn.json,
commit, and reply with that JSON only (no prose). If you cannot proceed, reply with the JSON, status
"blocked", and a "blocked_reason". Bundle: <T-IDs in order, or "none">.
```

## Handover (JSON, written by the implementer, validated by `lint.mjs handover`)

Kept deliberately small. A human needs only `summary`, `status` and `deviations`; agents use `produces`
and `next`. The file `handovers/Tn.json` is committed with the task, so it survives a dead orchestrator.

```json
{
  "task": "T2",
  "status": "done",
  "summary": "Added the repository and migration 0007; 14 tests pass.",
  "commit": "a1b2c3d",
  "produces": [
    { "kind": "symbol", "name": "ThingRepo.findByOwner", "where": "src/repo/thing.ts", "note": "(ownerId: string) => Promise<Thing[]>" }
  ],
  "next": "Repo returns [] not null for unknown owners. Soft-deleted rows are excluded.",
  "deviations": [],
  "edge_cases": ["E2", "E5"],
  "checks": { "build": "pass", "tests": "14 pass, 0 fail", "lint": "pass" }
}
```

`status`: `done` | `blocked` | `partial` (the last two require `"blocked_reason"`). `produces[].kind`:
`symbol` | `file` | `route` | `table` | `env` | `other`. A deviation is `{ "what", "why", "needs":
"operator" | "orchestrator" | "none" }`. `next` is at most 3 short lines for the dependent tasks.

## Choosing the review

Start from the task's `Review` tag; you may **raise** it, never lower it. Raise it when the report shows
any of: a deviation, a build or test failure fixed on the second try, files changed outside the task's
Files table, a missing `produces` entry the task file required, a security surface the planner missed.

| Level | What you do |
|---|---|
| none | rely on the green build and the wave check |
| light | one `reviewer` subagent, Implementer lens, given the task file path and `git diff <base>..<commit>` |
| full | Implementer + Tester reviewers in parallel (+ Attacker on a security surface), same inputs |

Reviewers get the task file and the diff, nothing else. Fix blocking findings through the implementer;
record rejected findings with a reason in the Changes line. A clean per-task review does not replace the
close-out review of the whole branch.

## Parallel work

- **Waves inside this plan.** Parallel sets run in isolated worktrees as in step 2. You alone merge,
  in task order. `.ws/current-task` is per checkout, which is another reason for isolation.
- **Another orchestrator on the same workstream** (unusual): both share the one branch-state file, each
  with its own session row; claim tasks by the `In progress (<session>)` marker before dispatching, and
  touch only your own rows in plan.md. Different workstreams run in their own worktrees.

## When reality diverges

Stop at the first sign of: a failed Expected state check, a path or symbol that does not exist, a spec
rule that cannot be met, a test the plan did not anticipate, an edge case not in the plan, a decision the
operator has not made. Then:
1. Write a Deviation (`D~n`) in the branch state: what, the consequence, what was done.
2. Plan-only fix (extra step, reorder within a task, a task file correction): edit the task file, record a
   Changes line, redispatch.
3. Anything that changes behaviour, a task boundary, dependencies or a requirement: amend the spec first
   (`writing-specs-lite-v2` change control, a Decision `C~n`), regenerate the affected task files and the
   spec hash, re-lint, then continue. If the operator must decide, set the session
   `Blocked - needs human` with the question as `Q~n` and stop.
Never silently change scope, weaken a test, or mark work done that is not. Contract tests from
`authoring-tests` are read-only to implementers; a disputed test is a Deviation.

## Resuming (also how a replacement orchestrator starts)

Read `STATE.md`, `guardrails.md`, the branch state and `plan.md`, then:
- Tasks `Done`: trust them, but confirm `handovers/Tn.json` exists.
- A task `In progress` with a handover file: validate it and treat it as reported.
- A task `In progress` without one: look at `git log --grep "Task: Tn"` and `git status`. If a commit
  exists, dispatch a short subagent to verify it and write the handover. Otherwise redispatch the task;
  its Expected state check protects against half-done edits.
- Reset your session row's Next action to the first ready task.

## Close-out (the plan's `## Close-out`)

Follow the checklist in plan.md: `lint.mjs plan --closeout` clean; `<BUILD>` green and each F/N backed by a
passing test or a recorded manual check (state plainly which you could not run); `code-review` of the
branch diff; branch state to `In review` with session rows removed, Changes lines, new Known Gaps,
Conventions and Deviations, `Post-merge` tasks as Handover items, `guide out of date: <what>`. Then
**ask for review** (`AGENTS.md` § 8, gate 3): one question covering what was built, checks run and not
run, open Deviations and Handover items. Do not push, open a PR or merge. On the operator's yes write
`Status: Approved` and `Approved: <name> <date>` in the branch state and commit it, then ask separately
whether to push and open the PR (a `GATE:` step). A clean review or build is not a yes.
