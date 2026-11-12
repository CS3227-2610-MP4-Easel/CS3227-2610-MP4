---
purpose: Update only the affected developer-guide sections after an approved checkpoint proposal.
tier: mid
reasoning: medium
tools: read, search, write
reads: docs/guide/index.md, sections from ws guide-targets, the changed-path diff
writes: docs/guide/**
forbidden: code, workflow/project-state/**
returns: sections changed
---
Follow the update-documentation skill. Write only what the operator approved. Where code and spec
differ, the guide describes the code and cites the deviation ID.
