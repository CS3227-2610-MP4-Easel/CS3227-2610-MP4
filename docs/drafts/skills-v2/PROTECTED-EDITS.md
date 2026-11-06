# Remaining pivot edits (review-required paths)

`AGENTS.md` is already updated (§ 3 skill names, § 7 subagent reading exception, § 8 gate table).
The edits below are in paths agents cannot write (`workflow/agents/**`, `workflow/manifest.json`,
`workflow/skills/**`). Apply by hand, then run `node workflow/tools/ws.mjs adapters claude` and `adapters codex`.
Skills are edited at user level and re-synced (`ws skills sync`), so make the `skills/**` edits in
`~/.claude/skills/` first.

## 1. `workflow/agents/implementer.md` (then `ws adapters`)
Replace the `reads`/`writes`/`forbidden`/`returns` lines and the body with:

```
reads: its task file, the Shared context and dependency handovers pasted in the brief, its tests and interface stubs
writes: src/**, workflow/plans/**/handovers/**
forbidden: test files marked read-only, workflow/project-state/**, spec files, STATE.md, guardrails.md, branch state, other task files
returns: the handover JSON only (see executing-plans-lite-v2)
---
You implement one task in a fresh context (executing-plans-lite-v2). Read your task file fully and
nothing in the state or spec folders. Run its Expected state checks first; if one fails, return
status "blocked" before editing. Run `ws task start <T>` first. Tests marked read-only are not
yours to edit: if you believe one is wrong, stop and report a Deviation. Use plan snippets as
intended shape and adapt to the real code, noting why in the commit message. Verify with the quiet
runner (`ws test`) and read full logs only if the summary is not enough. End by writing
`handovers/<T>.json`, committing it with your code, and replying with that JSON only.
```

## 2. `workflow/agents/planner.md` and `spec-writer.md`
- planner: "Follow the writing-plans-lite-v2 skill." Replace "Tag every code snippet ... and a T0
  contracts task and waves" wording with: "Produce a plan folder (plan.md + tasks/Tn.md). Tag every code
  snippet `[contract]` or `[impl]`. Each task file is self-contained and ends with Handover directions."
  `returns:` plan folder path, tasks, waves, review levels. `writes: workflow/plans/**` stays.
- spec-writer: "Follow the writing-specs-lite-v2 skill." (single file; `reads` drops "spec templates" plural).

## 3. `workflow/manifest.json`
`"implementer":  { "files": [], "branchState": false, "byArea": false }` (the task file carries the rules).
Optional: `"reviewer"` stays; it already omits STATE.md.

## 4. `workflow/skills/drafting-interfaces/SKILL.md` line 10
```
1. Read only the spec's contracts and the conventions for file layout: § 4.2 Data model and § 4.3
   Interfaces of a v2 single-file spec (or `api.md` and `data-model.md` of a v1 spec folder).
```

## 5. `workflow/skills/authoring-tests/SKILL.md` line 17
"It sees: spec components, stubs, edge-case rows" becomes "It sees: the spec's § 4.2-4.3 contracts and
§ 5 edge-case rows (v1: spec components), the stubs, ...". No other change; tests derive from the
spec, which still exists, so blind authoring works unchanged. Ordering note: tests run before the plan
exists, so the planner must list the contract-test files as read-only in the relevant task files.

## 6. Router template and prose (names only)
- `workflow/skills/project-state/templates/agents-router-template.md` lines 6, 50-51, 92-94: same three
  edits made in `AGENTS.md`.
- `workflow/skills/project-state/templates/agents/planner.md`, `.../spec-writer.md`: as item 2.
- `workflow/skills/branch-state/SKILL.md` line 50, `slicing-architecture/SKILL.md` line 3,
  `README.md` flow diagram and skills table (lines 24-55): add the `-v2` names; keep v1 mentioned as audit.
- `workflow/config.json` already lists the v2 skills (committed).
