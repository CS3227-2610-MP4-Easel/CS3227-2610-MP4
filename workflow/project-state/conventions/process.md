# Conventions — Development Process

How the team and its agents work (AD-30, AD-31, AD-32). Slice owner = the member who owns a role slice in [delivery-plan.md](../../../docs/architecture/delivery-plan.md) section 3.

- Each owner advances the stages for their own workstream; the slice owner approves their own specs, plans and branch reviews (C3).
- Hand-offs go through files (spec, plan, tests, review report, branch state), not chat. Each hand-off note ends with a task log: agent, model, retries, outcome (AD-31).
- The implementer and reviewer loop is capped at two rounds; a disagreement is settled by the spec clause the reviewer cites, otherwise by the owner (AD-30).
- The author does not review their own security work: Developer slice is reviewed by the Dev Lead, Dev Lead slice by the Developer, PM slice (UI and proposals) by the Dev Lead.
- No secrets in the repository; `.env` ignored; production credentials never on developer machines; production deploys and migrations only from CI (AD-32, AD-53).
- Development telemetry: Claude Code OpenTelemetry metrics aggregated to a CSV in `docs/telemetry/`, counts only (AD-31).
