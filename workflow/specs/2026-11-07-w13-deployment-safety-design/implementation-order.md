# Implementation order

| Task | Outcome | Depends on | Can run concurrently with | Wave |
|---|---|---|---|---|
| T1 | Add protected Vercel metadata lookup and exact deployment verification tests | — | T2, T3, T4 | 1 |
| T2 | Bind seed execution to the immutable database target map and add mismatch tests | — | T1, T3, T4 | 1 |
| T3 | Enforce every committed migration manifest entry before Prisma execution and redact child env | — | T1, T2, T4 | 1 |
| T4 | Separate Vercel environment mapping and make dev/prod resource validation unconditional | T2 | T1, T3 | 2 |
| T5 | Integrate the workflow, run the full verification suite, and record evidence | T1, T2, T3, T4 | — | 3 |

Shared integration files (`.github/workflows/w13-dev-check.yml`, `workflow/deployment/tier-manifest.json`, and W13 branch state) are serialized in T5 after the safeguards are complete. The Vercel metadata request runs before checkout in the protected workflow step; checked-out code receives only sanitized metadata. T2 creates the shared validated tier-manifest loader; T4 depends on it.
