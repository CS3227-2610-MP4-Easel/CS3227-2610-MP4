# Skill Feedback — Flag Bounds That Do Not Fit

The skills carry soft limits and flows chosen before any project used them (file sizes, read
lists, ceremony per tier, review counts). They are guesses until measured. **While you work,
notice when one is wrong and say so**, so the skills improve instead of being worked around.
Skills are edited only at user level (`~/.claude/skills`); a project records the observation, the
operator decides, and the change is made there and re-synced (`ws skills sync`).

## Flag it when

| Signal | Example |
|---|---|
| A size target is wrong | `ws budget` shows `STATE.md` over 8 KB for good reasons, or a spec template forces padding under a cap that is too high |
| A read list is too long or too short | `ws pack` loads files you never used, or you had to read cold files it did not list |
| A flow costs more than the change | a Small change walked through a Medium step; a gate that only ever gets rubber-stamped; a section always written "none" |
| A rule is skipped under pressure | the same step is dropped by several sessions: the rule, not the sessions, may be wrong |
| Repeated rework | the same file reread or rewritten each session; a fold that always needs hand edits |
| Cost or time outlier | one stage dominating tokens, or a reviewer pass with no findings across many runs |
| Tool gap | something done by hand five times that `ws` could do |

Flag only with evidence (a number, a count, a file, a repeat). Do not flag taste, and do not
wait for a perfect case: one clear data point is enough to log, the operator decides what to do.

## How

1. Log it at once: `node workflow/tools/ws.mjs feedback <skill> --issue "..." --evidence "..." --suggest "..."`
   (appends a row to `workflow/skill-feedback.md`, creating it if missing). Without Node, append
   the row by hand using the same columns.
2. Say it in one line to the operator when it first blocks or slows you, with the suggested change.
   Do not stop work for it, and do not edit the vendored skill (`ws skills check` flags edits).
3. At a stage boundary (branch finished, phase end), read the log. If three or more rows are
   open, or one is costing time now, tell the operator and propose a revision batch: which skill
   or limit, the new value or flow, and the expected saving in tokens, files read, or steps.
4. When the operator accepts, they (or an agent in the user-level skills repo) make the change,
   run `ws skills sync` in the project, and set the row's status to `Applied <date>`.

## Entry columns

| Date | Skill / limit | Issue | Evidence | Suggested revision | Status |
|---|---|---|---|---|---|

Status: `Open` · `Accepted` · `Rejected (why)` · `Applied YYYY-MM-DD`. Keep the file short:
delete nothing, but fold applied or rejected rows into one summary line when it passes ~30 rows.

## What a good suggestion states

The current value, the proposed value, and the saving or risk, in the three currencies the
ecosystem optimises: **context** (tokens read per session), **resource use** (tool calls,
containers, reviewers run) and **cost** (model tier or review depth). Example: "`STATE.md` 8 KB
cap: 11 of 14 sessions needed more than 9 KB to stay accurate; raise to 10 KB, or move the
Upcoming table to its own cold file (saves ~700 tokens per session)."
