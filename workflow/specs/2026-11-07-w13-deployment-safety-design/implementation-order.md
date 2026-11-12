# Implementation order

| Task | Outcome | Depends on | Can run concurrently with | Wave |
|---|---|---|---|---|
| T1 | Retired automated dev-check; retain exact tier/resource validation | — | T2, T3, T4 | 1 |
| T2 | Bind seed execution to the immutable database target map and add mismatch tests | — | T1, T3, T4 | 1 |
| T3 | Enforce every committed migration manifest entry before Prisma execution and redact child env | — | T1, T2, T4 | 1 |
| T4 | Record owner-operated Vercel metadata and fixed development smoke evidence; keep dev/prod resource validation unconditional | T2 | T1, T3 | 2 |
| T5 | Run the full verification suite and record the approved evidence | T1, T2, T3, T4 | — | 3 |

Shared integration files (`workflow/deployment/tier-manifest.json` and W13 branch state) are serialized in T5 after the safeguards are complete. T4 is an owner-operated manual Vercel/development smoke gate and has no repository workflow or deployment verifier. T2 creates the shared validated tier-manifest loader; T4 depends on it.
