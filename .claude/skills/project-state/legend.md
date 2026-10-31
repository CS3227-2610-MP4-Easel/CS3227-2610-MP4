# Legend Rule

Several ID families look alike (`C` decisions, `D` deviations, and — once `architecting-systems`
output moves under this layout — `AD-nn` architecture decisions and `G-nn` architecture gaps).
**Every template table that holds IDs opens with a one-line legend** naming its notation, so a
reader never confuses, say, a Deviation with an Architecture Decision.

Use this wording, copied verbatim into the relevant template or file:

- **Decision tables** (`STATE.md` §4, `guardrails.md`'s Binding Decisions, `decisions/C<n>.md`,
  an area's Decisions table): `Legend: C = project decision. AD-nn entries are in
  docs/architecture.` (Drop the second sentence until the project actually has `AD-nn` IDs.)
- **Deviation tables or sections** (`deviations/D<n>.md`, a branch state's Deviations section):
  `Legend: D = Deviation, where reality diverged from a spec or plan. Not to be confused with
  AD-nn, an Architecture Decision.`
- **Architecture decision log**, once adopted: `Legend: AD = Architecture Decision (intended
  design). G = architecture gap. Not to be confused with D<n>, a Deviation in project state.`

This rule is checked the same way everywhere: open any template above, and the legend line should
already be there — if you are copying an older template that lacks it, add the line before using
the file.
