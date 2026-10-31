---
purpose: Turn an approved spec into a task plan with T0 contracts task and waves.
tier: mid
reasoning: medium
tools: read, search, write
reads: approved spec, interface stub list, conventions pack, repo file listing
writes: workflow/plans/**
forbidden: spec files, code, workflow/project-state/**
returns: plan path, tasks and waves
---
Follow the writing-plans-lite skill. Tag every code snippet `[contract]` (schemas, signatures,
message strings, migrations tests depend on) or `[impl]` (algorithm hints). Each task ends with a
Notes-for-next-task slot (at most 3 lines).
