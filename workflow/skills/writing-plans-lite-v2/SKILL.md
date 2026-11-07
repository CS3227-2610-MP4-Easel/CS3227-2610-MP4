---
name: writing-plans-lite-v2
description: Use when an approved v2 spec (writing-specs-lite-v2) needs an implementation plan before coding. Produces a plan FOLDER - a small plan.md (router, shared context, task order, traceability) plus one self-contained file per task (expected state, objective, rules, contract, files, steps, handover directions) - so an orchestrator can dispatch subagents that read only their own task file. Default since v2; v1 (writing-plans-lite) is retained for audit only.
---

# Writing Plans (lite, v2)

The plan is where the work is split. The spec decides *what*; the plan decides *which tasks, in which
order, with which files and checks*, and writes each task so that **one subagent can do it by reading
one file**. After the plan is approved the spec is not used again.

**Announce at start:** "I'm using writing-plans-lite-v2 to write the plan."

**Tier.** Medium changes have no separate plan (their single spec file carries the task list).
This skill is for Big changes.

## Preconditions

- The spec is `Approved`, `Format: v2`, with no open `Q`. If not, stop and finish the spec first.
- Read `guardrails.md`, the relevant `conventions/<topic>.md` files and the branch state. A task must
  not implement a Known Gap or contradict a decision; if one would, raise it (`AGENTS.md` § 4).
- Read the whole spec once. You are the last reader who needs it: everything an implementer needs
  from it must end up inside the task files.

## Layout

```
workflow/plans/YYYY-MM-DD-<topic>/
    plan.md              <- router: scope, shared context, task order, traceability, close-out (<= 200 lines)
    tasks/T1.md ...      <- one self-contained file per task (<= 150 lines)
    handovers/           <- created at execution time: T1.json ...
```

Start from `templates/plan.md` and `templates/task.md`.

## Rules

1. **Tasks follow the work, not the spec's headings.** Cut where a clean handover is possible: each
   task delivers something a later task can rely on or a reviewer can judge alone. IDs `T1..Tn` in
   order; a task depends on another only if it needs its output or interface.
2. **Self-contained task files.** A task file is everything its implementer reads (plus the pasted
   Shared context). **Copy** the contracts, rules, edge-case rows and conventions the task needs into
   it, with their IDs. Never write "see spec § 4.3". The task file must not tell the implementer to read
   `STATE.md`, `guardrails.md`, the branch state or the spec.
3. **Expected state is checkable.** List what must already be true when the task starts, each as
   something the implementer can verify in seconds (file exists, symbol present, migration applied,
   value from a named earlier task's handover). A mismatch stops the task before any edit.
4. **Exact files.** Verify every path: each Modify exists (name the symbol or lines), each Create does
   not, directories sit in the right layer. Include test files.
5. **Say what changes; include code only where context would be lost.** Snippets for tricky logic,
   schemas and migrations (full SQL), signatures, message strings. Tag each `[contract]` (tests or other
   tasks depend on it) or `[impl]` (intended shape; adapt to real code). No boilerplate.
6. **Steps default to TDD** and end in an observable result: failing test, implement, green, build,
   commit. At most 10 numbered steps; more means split the task.
7. **No placeholders.** No "TBD", "handle edge cases", "similar to Task N". Edge-case rows assigned to
   the task are copied in full (scenario and exact expected behaviour).
8. **Handover directions are mandatory.** Each task states what it **produces** (the names, paths,
   signatures and shapes later tasks will use) and, for every task that depends on it, one line
   saying what that task needs to know. The implementer reports these in `handovers/Tn.json` (schema in
   `executing-plans-lite-v2`); the orchestrator passes them to the next implementer.
9. **Tag weight and review** for every task (table below). The orchestrator may raise a tag, never lower it.
10. **Gate human actions.** Start any step that leaves the machine or needs the operator's yes with
    `GATE:`. A task made only of human steps outside the repo is `Post-merge`.
11. **Same-wave tasks share no files**; mark them concurrent only when that holds. Shared-file hazards
    from the spec's § 4.6 become dependencies.
12. **Few commits, green builds**: one commit per task, handful of files. More than ~15 files in a task: split it.

## Weight and review tags

| Weight | Meaning | Default review |
|---|---|---|
| trivial | up to 3 files, mechanical (config, rename, copying an existing pattern, docs), no new branching logic | none (High-tier spec: light) |
| standard | new logic with tests inside one layer | light |
| complex | state machine, algorithm, concurrency, migration, cross-layer, or more than ~8 files | full |

Raise the review to **full (with the Attacker lens)** for any task on a security surface: authentication
or session, roles or ownership, tenancy, money, personal data, secrets or tokens, untrusted input, or a
path in `workflow/security-sensitive-paths.json`. Review levels: **none** = green build and tests only;
**light** = one reviewer, Implementer lens, on the task diff; **full** = Implementer + Tester lenses
(+ Attacker where tagged). Write a few words of reason in the task file's header when not the default.

Trivial tasks that are adjacent and independent may carry a `Bundle:` note in the Task order table
(for example `Bundle: T2+T3`) so the orchestrator can give them to one subagent. Never bundle across
different review levels above `none`.

## Process

1. Check preconditions; read the spec, guardrails, conventions and branch state.
2. **Verify against the repo**: open each file you will list; confirm names, signatures, layering and
   whether it already exists. Fix the plan, not the guess.
3. Choose the tasks, dependencies, waves, weights, reviews. Write `plan.md` first, then each task file.
   Add steps for every spec convention the task touches.
4. **Stamp the spec**: `node .claude/skills/writing-specs-lite-v2/scripts/lint.mjs hash <spec.md>`; put
   the value in plan.md's `Spec hash:`.
5. **Lint**: `node .claude/skills/writing-specs-lite-v2/scripts/lint.mjs plan <plan-dir>/plan.md`. It
   checks task files against the table, Satisfies vs Traceability, dependency and wave logic, handover
   coverage, shared-file hazards, paths against the repo, size caps. Fix every error.
6. **Review** (Medium and High tier; optional for Low): one read-only `reviewer` subagent on the plan
   folder. It checks that each task file is self-contained (could an agent do it from that file alone?),
   then logic and seams against the repo. At most two rounds; unresolved blockers become questions.
7. **Ask the operator to approve** (`AGENTS.md` § 8, gate 2). One question naming the plan path, task
   count and waves, the review level of each task, and the `GATE:` and `Post-merge` tasks; the operator
   reads `plan.md`, not every task file. On a yes write `Status: Approved (<name>, <date>)` in plan.md
   and run `lint.mjs plan <plan.md> --approved`.
8. Record in the branch state (workstream `Planned`, plan link, Changes line); commit the plan folder
   alone (`docs: plan for <topic>`).
9. Start `executing-plans-lite-v2` without a further approval question (the plan approval covers it).

## Changing the plan or spec mid-flight

Plan-only change (extra step, reorder within a task, retag): edit the task file and plan.md, record a
Changes line. Anything that changes behaviour, a task boundary, dependencies or a requirement: amend the
spec first (`writing-specs-lite-v2` change control), then regenerate the affected task files and the
spec hash, then re-lint. Never change a task file that is `In progress` under a running subagent;
wait for its report.

## Self-review

- [ ] Every F, N and E ID is in Traceability with a task and a verifier; each task's Satisfies matches it.
- [ ] Each task file is self-contained: contracts and rules copied in, no pointer to the spec or state files.
- [ ] Expected state is checkable; every dependency's handover is named where it is used.
- [ ] Every task with dependents has handover directions for each of them.
- [ ] Weight and review set with the security-surface rule applied; GATE and Post-merge marked.
- [ ] Paths verified; same-wave tasks share no files; waves consistent with dependencies.
- [ ] No task over 10 steps or 150 lines; plan.md under 200 lines; Shared context under 40.
- [ ] `lint.mjs plan` passes; spec hash stamped.
