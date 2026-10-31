# Model-Routing Experiments

**Status: hypothesis only; not run.** Nothing in a role, skill or script names a model; tiers
(`strong` / `mid` / `cheap`) resolve through `workflow/models.json`. Defaults are the tool default
(Claude Code Sonnet 5.5 medium; Codex GPT-6.1 Sol medium) for every tier until a run below says
otherwise. **The team picks the model per tier.** Before any run, list the candidate models for the
tier and ask the operator to confirm or change them; write the confirmed choice into `models.json`.
Re-pull current prices at run time; do not reuse old figures.

## Fixtures (replay real artifacts, no new project)

| Role | Fixture | Ground truth |
|---|---|---|
| reviewer | 2 existing specs (one small, one large) with 5-8 seeded defects (contradiction, missing error, guardrail collision, wrong path, vague term) plus the original strong-model findings | seeded set + baseline findings |
| state-clerk | 20 recorded events (task finish, decision, deviation, session handoff) | expected branch-state diff, scored by `ws` validation and the acid test |
| test-author | 3 tasks that already have tests | mutation score of generated tests against the real implementation; E-ID coverage |
| implementer | 3 plan tasks (revert, re-implement against red tests) | tests pass, diff size, convention lint |
| planner | 2 approved specs | `lint.mjs plan` clean + reviewer blocking-finding count |

Run each cell 3 times (variance). Record per run: input and output tokens (from the subagent
usage line), wall time, cost at current prices, pass/fail, defect recall, false-positive rate.

## Candidates file

`workflow/experiments/candidates.json`:

```json
[{ "provider": "claude", "model": "<id>", "reasoning": "medium", "tier": "mid" }]
```

Adding a model or provider is a data change. Run a cell by spawning one subagent per run with the
role file from `workflow/agents/` and the candidate's model override, then record the result row.

## Decision rule

Adopt the cheaper model for a role only if, across runs:
1. recall of seeded **blocking** defects is at least 95% of the stronger model's, with no missed guardrail collision;
2. output passes `ws` / lint validation at the same rate (state-clerk: 100% acid-test pass);
3. total cost is lower after counting retries.

Otherwise keep the stronger model. Record the result in `models.json` and re-run on a model-family change.

## Other levers to test

- Fast mode for the implement loop (same model, faster output: saves time, not cost).
- Main-session effort level per stage.

## Results record (copy per experiment)

| Role | Candidate | Run | Tokens in/out | Cost | Time | Pass | Recall | False pos |
|---|---|---|---|---|---|---|---|---|
