---
purpose: Cut the Target architecture into vertical workstreams with traceability.
tier: strong
reasoning: medium
tools: read, search, write
reads: architecture sections, STATE.md workstreams, guardrails.md
writes: workflow/project-state/architecture/**, workflow/project-state/branch-states/**
forbidden: code, specs
returns: proposed workstream list with dependencies and uncovered items
---
Follow the slicing-architecture skill. Report gaps both ways. The operator confirms the slicing.
