# AGENTS.md Router Template

Copy to the project root as `AGENTS.md` (and have `CLAUDE.md` import it only). **Soft target ~3 KB
— no hard cap, but justify growth.** Procedure lives in the `project-state` and `branch-state`
skills; this file only routes. Section numbers below are fixed because the `project-state`,
`branch-state`, `writing-specs-lite`, `writing-plans-lite`, `executing-plans-lite`,
`sync-project-state`, `refresh-project-state` and `update-documentation` skills cite them by
number (`AGENTS.md § 4`, etc.) — do not renumber without updating every citing skill.

---

````markdown
# AGENTS.md

Router only. Procedure for everything below lives in the `project-state` and `branch-state`
skills (run `Skill` on the relevant one rather than reading this file for detail).

## 1. Branches

`INT` = <name, e.g. `development`> — the integration branch feature branches merge into, where
`workflow/project-state/STATE.md` and the developer guide are written. `main` is the **release
branch**: it only receives `INT` by pull request; no state file or guide is written on it.

## 2. Write Immediately When

On a branch, write to the branch state (`branch-state` skill), never to `STATE.md` directly:

- A workstream changes status, or a task starts, finishes, or blocks.
- A session starts, changes what it is doing, or ends.
- The shape of the system changes — write the affected area's proposed Now.
- The operator makes or changes a decision — capture *who asked and why*.
- A spec or plan is created or materially revised.
- Work completes, or reality diverges from a plan — a Changes line, and a Deviation if it
  diverges.
- The session is ending or context is low — reconcile so a different session can take over cold.
- You merge `INT` into the branch, or the branch is finished.

Full detail, triggers and worked examples: `branch-state` skill.

## 3. Size Decides the Ceremony

| | Big | Medium | Small |
|---|---|---|---|
| Examples | New capability, schema/model change, security-sensitive, cross-cutting | Scoped correction, new endpoint on an existing surface, small UI addition | Bugfix inside existing design, copy/style, config |
| Before coding | Spec folder, then plan, then a Workstream row | One file (<~4 KB); its task list is the plan | Nothing |
| Review | Lenses by risk tier | 1 reviewer (Implementer lens) | None |
| After | Workstream status + Changes line | Same | A Changes line |

Ask first: does it change a contract, a schema, or permissions? No → Medium at most. Still
ambiguous → Big. Use `writing-specs-lite`, `writing-plans-lite` and
`executing-plans-lite` unless the operator names `brainstorming`, `writing-plans` or
`reviewed-plan`.

## 4. Collision With a Recorded Decision

If a request collides with `guardrails.md` or `STATE.md`'s decision index — **stop and confirm
before doing anything.** Name the entry, then ask: keep the decision (do nothing), or reverse it
(record the reversal, give the work its own workstream). Act on neither until the operator
answers, even if they said "just do it."

## 5. Developer Guide

| Setting | Values | Default |
|---|---|---|
| `Developer guide checkpoint` | `feature` · `phase` · `manual` | `phase` |
| `Developer guide optional sections` | `none` · `user stories` · `use cases` · both | `none` |

Procedure: `update-documentation` skill.

## 6. Commits

One logical change per commit, message `type: what and why (workstream)`, never a provisional ID.
Add `Workstream:` / `Task:` trailers when working under a workstream. Full convention, trailer
format and granularity: `branch-state` skill, `commits.md`.

## 7. Reading Rule

If `workflow/tools/ws.mjs` exists, `node workflow/tools/ws.mjs pack <role> [--area A]` lists
exactly what your role should read. Otherwise: read `workflow/project-state/STATE.md` and `guardrails.md` in full every session; on a branch,
also its branch state. Pull a cold file (`architecture/<area>.md`, `conventions/<topic>.md`,
`decisions/C<n>.md`, `deviations/D<n>.md`) only when the task touches it — never the whole
`architecture/` or `decisions/` folder "to be safe." Never reconstruct project history from the
source tree; code shows what is, never what was decided or rejected.

## 8. Approval Gates

The agent asks one question and writes the owner's yes. Never proceeds past a gate on silence or
a partial yes.

| Gate | Point | Skill |
|---|---|---|
| 1 | Spec approval | `writing-specs-lite` |
| 2 | Plan approval | `writing-plans-lite` |
| 3 | Branch review (before merge) | `executing-plans-lite` / `branch-state` |
| 4 | Fold a merged branch state | `sync-project-state` |
| 5 | Fold report + guide question | `sync-project-state` |
| 6 | Guide confirmation for a `Done` workstream | `update-documentation` |
````
