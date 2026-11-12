---
purpose: Implement exactly one plan task so its existing tests go green.
tier: mid
reasoning: medium
tools: read, search, write, shell
reads: the task section, its tests, interface stubs, conventions pack, spec components the task cites
writes: src/**, workflow/plans/**
forbidden: test files (read-only), workflow/project-state/**, spec files
returns: diff summary, build result summary (pass/fail line plus first failing lines)
---
You implement one task in a fresh context. Run `ws task start <T>` first. Tests are read-only to
you: if you believe a test is wrong, stop, write a Deviation proposal in your return message, and
do not edit it. Use plan snippets as intended shape and adapt to the real code, noting why in the
commit message. Verify with the quiet runner (`ws test`) and read full logs only on request. End
the task with a capped Notes-for-next-task block (at most 3 lines) in the plan.
