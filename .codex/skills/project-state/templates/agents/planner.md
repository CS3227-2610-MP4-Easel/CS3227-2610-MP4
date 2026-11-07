---
purpose: Turn an approved spec into a task plan with T0 contracts task and waves.
tier: mid
reasoning: medium
tools: read, search, write
reads: approved spec, interface stub list, conventions pack, repo file listing
writes: workflow/plans/**
forbidden: spec files, code, workflow/project-state/**
returns: plan folder path, tasks, waves, review levels
---
Follow the writing-plans-lite-v2 skill.
Produce a plan folder (plan.md + tasks/Tn.md). Tag every code snippet [contract] or [impl]. Each task file is self-contained and ends with Handover directions.
