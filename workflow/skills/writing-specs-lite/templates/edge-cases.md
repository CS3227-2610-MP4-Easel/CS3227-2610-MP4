# Edge Cases and Non-Happy Paths

IDs are permanent: never reuse or renumber. Every F requirement and every API error appears in at least one row.

## <theme: input | state | concurrency | failure | permission | time | volume | migration>
| ID | Requirement | Scenario | Expected behaviour (exact) | Why it matters | Test layer |
|---|---|---|---|---|---|
| E1 | F1 | <scenario> | <exact outcome> | <consequence if wrong> | unit |

## What could corrupt data (High tier)
- <failure mode and the guard that prevents it>
