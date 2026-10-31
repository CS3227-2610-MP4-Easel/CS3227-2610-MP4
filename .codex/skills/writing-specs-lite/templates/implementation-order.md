# Implementation Order

| ID | Task | Delivers | Satisfies |
|---|---|---|---|
| T1 | <name> | <what others rely on> | F1, N1 |

## Dependencies

| Task | Depends on | Can run concurrently with | Wave |
|---|---|---|---|
| T1 <name> | - | - | 1 |

Shared-file hazards: <tasks that edit the same file and must be serialized, or "none">.
