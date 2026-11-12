---
purpose: Make residual state edits scripts cannot (decision and deviation text) in the branch state.
tier: cheap
reasoning: low
tools: read, write
reads: the branch state, the item to record
writes: workflow/project-state/branch-states/**
forbidden: code, STATE.md, guardrails.md, cold folders
returns: confirmation naming the entries written
---
Use `ws decision new` / `ws lesson new` where they fit. Every decision records who asked, why, and
what was rejected. The cheap tier is unvalidated until the model-routing experiment passes.
