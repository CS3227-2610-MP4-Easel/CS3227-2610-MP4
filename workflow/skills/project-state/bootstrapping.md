# Bootstrapping — Creating the State Layout

When `workflow/project-state/STATE.md` does not exist. One-time procedure; do it before any other
work, and do not let it expand into a project audit.

## Steps

1. **Create the tree**:
   ```bash
   mkdir -p workflow/project-state/architecture workflow/project-state/conventions \
            workflow/project-state/decisions workflow/project-state/deviations \
            workflow/project-state/ledger workflow/project-state/branch-states/archive
   ```
   Add a `.gitkeep` to any empty directory.
2. **Copy the skeletons** — [templates/state-template.md](templates/state-template.md) to
   `STATE.md`, [templates/guardrails-template.md](templates/guardrails-template.md) to
   `guardrails.md`. If the project has no `AGENTS.md` yet, copy
   [templates/agents-router-template.md](templates/agents-router-template.md) to the repo root
   too, filling in `§1 Branches`.
3. **Harvest what already exists**, in this order — earlier sources beat later ones on intent:
   - `workflow/specs/*` — purpose, decisions with reasons, explicit non-goals. Non-goals populate
     `guardrails.md`'s Known Gaps / Out of Scope directly; the spec's architecture section is the
     skeleton of the `architecture/` folder.
   - `workflow/plans/*` — task breakdowns, which become Workstreams.
   - `git log --oneline` — the early ledger entries, and the true current state.
   - README, package scripts, CI config — the How to Resume commands.
   - The source tree — only to confirm what the documents claim, never as the primary source.
4. **Fill `STATE.md` §§1–3 and §5 properly** — Orientation, How to Resume, Workstreams, Needs a
   Human. They are what a cold agent reads first. The decision index (§4) and the cold folders can
   start sparse and grow.
5. **Create one `architecture/<area>.md` per real part** from the spec, not the source tree —
   what exists today; mark anything settled but unbuilt *(planned)*. Move every decision that
   shaped a part into that area's file (and its own `decisions/C<n>.md`); process decisions go in
   `STATE.md`'s decision index instead.
6. **Backfill the ledger coarsely.** Write `ledger/done-ledger.md` with one line per milestone,
   not per commit. History is context, not an audit trail — the ledger starts being precise from
   today.
7. **Mark what you inferred.** Anything deduced rather than read gets "(inferred)" on the entry.
8. **Report to the operator**: what you found, what you inferred, and every question the existing
   documents did not answer. Put those questions in `STATE.md` §5 too, so they survive the end of
   the conversation.

## Bounds

- Do not read the whole source tree. Specs and plans are the source; code is confirmation.
- Do not invent decisions. If no document says why something is the way it is, write
  "unknown — no record" in the relevant `decisions/` file rather than a plausible reason.
- Do not start the real work until the operator has seen the bootstrap. This is the one moment
  when the whole project's context is up for correction, and it is cheapest to fix now.
