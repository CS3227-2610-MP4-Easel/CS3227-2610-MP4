# Skills v2: install and pivot notes

Drafts of `writing-specs-lite-v2`, `writing-plans-lite-v2`, `executing-plans-lite-v2`. They are staged here
because `workflow/skills/**`, `.claude/**`, `.codex/**`, `workflow/agents/**`, `workflow/config.json`
and `workflow/skills.lock` are review-required paths for agents (`workflow/agent-permissions.json`).
`examples/` is a linted worked example (spec, plan folder, one handover); it is not part of the skills.

## 1. Place the skills (human step, via review)

Skills are edited at user level and vendored (`workflow/skills/README.md` "Where to edit"):

1. Copy the three folders to `~/.claude/skills/` (the `ws skills sync` source).
2. Add the three names to `skills` in `workflow/config.json` (v1 names stay listed: retained for audit).
3. `node workflow/tools/ws.mjs skills sync`, then commit `workflow/skills/` and `workflow/skills.lock`.
4. Mirror into `.claude/skills/` and `.codex/skills/` the way v1 is mirrored today.

The lint script is `writing-specs-lite-v2/scripts/lint.mjs` and serves all three skills
(`spec`, `plan`, `handover`, `hash`). v1's `lint.mjs` is untouched.

## 2. Pivot the defaults (proposed edits, not applied)

`AGENTS.md` § 3, last sentence of the paragraph:
> Use `writing-specs-lite-v2`, `writing-plans-lite-v2` and `executing-plans-lite-v2` unless the operator
> names `brainstorming`, `writing-plans`, `reviewed-plan`, or the v1 skills (`*-lite`, kept for audit).

`AGENTS.md` § 7, append:
> Implementer and reviewer subagents dispatched by `executing-plans-lite-v2` read only what their brief
> names; the orchestrator reads `STATE.md`, `guardrails.md` and the branch state.

`AGENTS.md` § 8 table: skills for gates 1, 2, 3 become the `-v2` names.
Same three lines in `workflow/skills/project-state/templates/agents-router-template.md`.

`workflow/agents/implementer.md` `reads:` becomes "its task file, the pasted Shared context, the
pasted handovers of its dependencies"; drop "spec components the task cites" and the plan
"Notes-for-next-task" line (replaced by `handovers/Tn.json`); `writes:` adds `workflow/plans/**/handovers/**`.
`workflow/agents/planner.md` and `spec-writer.md`: "Follow the `-v2` skill". `workflow/manifest.json`:
`implementer` files become `[]` and `branchState` false. Then `ws adapters claude` and `ws adapters codex`.

## 3. Not covered here (follow-ups)

- `drafting-interfaces` reads the spec's `api.md` and `data-model.md`; under v2 those are § 4.2-4.3 of the
  single spec. `authoring-tests` has the same dependency. Both need a small edit before a Big v2 spec
  uses the blind-test path.
- `ws` commands that assume the v1 layout (`pack`, `doctor`, `budget`) have not been checked against a
  plan folder.
- `sync-project-state` and `branch-state` mention the v1 skill names in prose only.
- The reading rule in § 7 and the `implementer` manifest entry are the main token saving; measure tokens per
  implementer on the first real v2 plan before tuning anything else.
