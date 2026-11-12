---
name: writing-plans-lite
description: Use when an approved spec (from writing-specs-lite) needs an implementation plan before coding. A lightweight alternative to superpowers writing-plans - one section per task from the spec's implementation order, each with exact files to create/modify, what changes, and a checklist the implementing agent ticks off as it works.
---

# Writing Plans (lite)

A plan turns an **approved spec** into **tasks an agent can execute and tick off**. The spec decides *what*; the plan decides *which files, in which order, with which checks*. It is a working document: the implementing agent updates its checkboxes as it goes.

**Announce at start:** "I'm using writing-plans-lite to write the plan."

**Tier.** Medium changes have no separate plan: their single spec file (`writing-specs-lite/templates/medium.md`) carries the task list, and `executing-plans-lite` runs from it. This skill is for Big changes.

## Preconditions

- The spec's index status is `Approved` and has no open `Q`. If not, stop and finish the spec first.
- Read `workflow/project-state/guardrails.md`, the relevant `conventions/<topic>.md` files and the branch state. A task must not implement a Known Gap or contradict a decision; if one would, raise it (`AGENTS.md` § 4) before writing the plan.
- Read the spec index and every component file, especially `implementation-order.md`.

## Commands

`<BUILD>` and `<TEST>` below mean the project's build and test commands from `STATE.md` §2 How to Resume. When the project has several components, each with its own command (for example `cd backend; .\gradlew build`), a task's steps name the command for the component it touches, and `<BUILD>` in the Verification gates and the Close-out means **every** component command, in the order that section lists them. Write the real commands into the plan and re-read the section each time.

## Rules

1. **Mirror the spec.** Sections are the tasks `T1..Tn` from `implementation-order.md`, same IDs, same order, same dependency table. Do not invent, merge or drop tasks; if the order is wrong, fix the spec first and note it.
2. **Exact files.** Every path is real: verify each "Modify" file exists (and the line range or symbol you refer to), each "Create" path does not and its directory is the right layer. Include test files.
3. **Say what changes, not the code.** Describe each modification precisely (method added, column added, branch changed, rule enforced) citing the spec section that defines it. **Include code snippets** wherever the planning session produced context the implementer would otherwise lose: tricky logic (algorithms, rounding, state transitions, concurrency/transaction handling), schemas and migrations (full SQL), signatures and interfaces, message strings, and any component whose correctness depends on a subtle choice. Snippets are the intended shape, marked as such; the implementer keeps them test-driven and adapts to the real code. Do not paste boilerplate the implementer can derive from the surrounding code.
4. **Checklist is the work.** Steps are small, ordered, verifiable, and each ends in an observable result. They default to TDD: failing test -> implement -> green -> commit. Name the tests and what each asserts.
5. **No placeholders.** No "TBD", "add error handling", "handle edge cases", "similar to Task N". Edge cases come from `edge-cases.md`: list the rows each task must cover by scenario name.
6. **Small, green commits** (`AGENTS.md` § 6): one commit per task (or per logical slice), builds with `<BUILD>`, handful of files. If a task touches more than ~15 files, split it and tell the operator the spec's order needs the same split.
7. **Gate human actions.** Start any step that leaves the machine or needs the operator's yes with `GATE:` (push, open a PR, deploy, publish, send a message, rotate a credential, anything irreversible). `lint.mjs` warns when a step mentions one without it. A task made only of steps a human performs outside the repo is `Post-merge`.

## Layout

Start from `templates/plan.md` in this skill folder.

`workflow/plans/YYYY-MM-DD-<topic>.md`, one file. If it passes ~600 lines, the spec's feature is probably two workstreams.

```markdown
# <Topic> Implementation Plan

> **For agents:** tick `- [ ]` -> `- [x]` as you finish each step, in this file, in the same commit as the work. Keep the branch state's Progress cell current (`AGENTS.md` § 2). Spec: [<topic> design](../specs/YYYY-MM-DD-<topic>-design.md).

## Scope
**Goal:** <one sentence, from the spec>
**In scope:** <bullet list, from spec Goals F/N IDs>
**Non-goals:** <bullet list, from spec Non-goals; includes any Known Gap this must not touch, by ID>
**Risk tier:** <from spec> - <what that means for verification below>

## Task order
<copy the spec's dependency table; add a "Status" column: Not started / In progress / Done / Blocked / Post-merge>

`Post-merge` marks a task a human does after the merge, such as a live deployment, a production data change, DNS, a secret rotation or the release PR. It has no code to review, so the executor skips it; `lint.mjs --closeout` accepts it as open, and the close-out makes each one a **Handover** item in the branch state.

## Traceability
| Requirement | Task(s) | Verified by (test class or manual check) |
|---|---|---|
| F1 | T1, T2 | `FooTest` |
| E3 | T2 | `FooTest.rejectsEmptyName` |
Every F, N and E ID from the spec appears (the lint script checks this); a row with no task or no verifier is a plan gap.

## Verification gates
- Per task: `<TEST>` for the touched area, plus the project's lint/style check if source changed.
- Before finishing: `<BUILD>` green; each spec F/N acceptance criterion has a passing test or a recorded manual check.

---

### T1: <name from spec>
**Delivers:** <outcome from spec> | **Satisfies:** F1, N2 | **Depends on:** - | **Wave:** 1

**Files**
| Action | Path | What changes |
|---|---|---|
| Create | `src/main/java/.../Foo.java` | <responsibility; spec ref `data-model.md` § Foo> |
| Modify | `src/main/java/.../Bar.java` (`method()`) | <exact change> |
| Test | `src/test/java/.../FooTest.java` | <cases: scenario names from edge-cases.md> |

**Checklist**
- [ ] 1. Write failing `FooTest`: <asserts>. Run `<TEST> <target>`; expect FAIL because <reason>.
- [ ] 2. Implement <change> in `Foo`/`Bar`.
- [ ] 3. Run the same test; expect PASS.
- [ ] 4. Cover edge cases: <scenario A>, <scenario B> (each a test).
- [ ] 5. `<BUILD>` green.
- [ ] 6. Update branch state: Progress, Changes line.
- [ ] 7. Commit: `feat: <what and why> (<workstream>)`.

### T2: ...

### Tn+1: Close-out (always last)
- [ ] Every Traceability row verified; `<BUILD>` green.
- [ ] Spec index status and plan Task order all reflect reality; amendments recorded in the branch state.
- [ ] Branch state: workstream `In review`, Progress cleared of session rows, Changes lines complete, new Known Gaps / Conventions / Deviations written (or listed in `Untouched:`), `guide out of date: <what>` noted if the guide is affected (the guide is not edited on a branch, `AGENTS.md` § 5).
- [ ] Ask the operator to review the branch (`AGENTS.md` § 8, gate 3); write `Approved` only on their yes, and never push, open a PR or merge before it.
```

## Process

1. Check preconditions.
2. **Verify against the repo**: open each file you will list; confirm names, signatures, package layering, and whether a file already exists. Fix the plan, not the guess.
3. Write the plan file task by task. Add steps for anything the spec's *Conventions* require (each rule listed in the spec's `conventions.md` and in `conventions/`, such as audit rows, money-writing paths, test-support helpers, date handling, regenerating committed seed data).
4. **Lint, then self-review** (below). Run `node .claude/skills/writing-specs-lite/scripts/lint.mjs plan <plan.md>` and fix every error (it checks task parity with the spec, traceability, file paths against the repo, checklist length). Then dispatch one read-only `lite-reviewer` subagent on the plan (Medium and High tier; optional for Low). It checks logic, then file/seam correctness against the repo. Fix blocking findings. At most two review rounds; after that unresolved blocking findings become open questions for the operator.
5. **Ask the operator to approve the plan** (`AGENTS.md` § 8, gate 2) before any code is written. Stop and ask one question naming the plan path, task count and waves, and the `GATE:` and `Post-merge` tasks; fold in their changes and ask again. On a yes, write `Status: Approved (<operator name>, <date>)` under the plan's title and run `lint.mjs plan <plan.md> --approved`.
6. Record in the branch state (workstream -> `Planned`, plan link, Changes line) and commit the plan alone (`docs: plan for <topic>`).
7. Start `executing-plans-lite` without a further approval question (the plan approval covers it), saying how you run it (inline task-by-task, or one subagent per task within a wave - only for tasks the dependency table marks concurrent and that share no files). The executor ticks the checklist and updates Status.

## Parallel execution

Only tasks in the same wave with no shared files run concurrently. Each agent owns its task's files and its own commits, never `git add -A`, and adds its own row to the branch state's Sessions table (Next action = task + first unticked step). The lead merges nothing out of order and re-runs `<BUILD>` after each wave. Two agents editing the plan file: each ticks only its own task's boxes.

## Resuming

The resume point is the first unticked box in the first task whose Status is not Done. Mirror it in the session row's Next action (task ID + step number) so a cold agent can continue. Tick boxes and update Status before ending any session.

## Changing the plan or spec mid-flight

Plan-only change (extra step, reordered steps within a task): edit the plan and record the change in the branch state (a Decision `C~n` if it came from a decision change, otherwise a Changes line, with what and why). Anything that changes behaviour, a task boundary, the dependency table or a requirement: amend the spec first (`writing-specs-lite` change control), then the plan. Record a Deviation in the branch state when the build diverged from either.

## During execution (for whoever implements)

- Work in task order, respecting the table; do a task's steps in order.
- Tick each box as soon as it is done; mark the Task order Status; update branch state Progress (position, ~15 words).
- If reality diverges (file missing, spec wrong, new edge case): stop, write a Deviation in the branch state, amend the spec/plan with the operator, then continue. Never silently change scope.
- A task is done only when its checklist is all ticked, the build is green, and the branch state reflects it.

## Self-review

- [ ] Scope/goals/non-goals match the spec; every F/N is satisfied by a named task.
- [ ] Task IDs, order and dependencies identical to the spec.
- [ ] Every path verified; every Modify names the symbol or lines.
- [ ] Every edge-case row from the spec is assigned to a task's tests.
- [ ] Each checklist ends in a commit and a green build; no step is vague; no checklist exceeds ~10 steps (split the task otherwise).
- [ ] Traceability table complete (F, N and E IDs); Close-out task present.
- [ ] `lint.mjs plan` passes with no errors.
- [ ] Names used in later tasks match names defined in earlier ones.
- [ ] No task implements a Known Gap or violates a Convention.
