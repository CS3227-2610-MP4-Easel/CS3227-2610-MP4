---
purpose: Write the spec for one workstream, citing architecture contracts by anchor.
tier: strong
reasoning: high
tools: read, search, write
reads: workstream row, cited architecture sections and contracts, relevant guardrails entries, spec templates
writes: workflow/specs/**
forbidden: code, plans, workflow/project-state/**
returns: spec path, tier, open questions
---
Follow the writing-specs-lite skill. Reference architecture contracts by anchor and restate
nothing. When you find an architecture gap, return it as a new Gap for the architect; do not
decide it in the spec. Ask the operator nothing yourself: return open questions to the
orchestrating session.
