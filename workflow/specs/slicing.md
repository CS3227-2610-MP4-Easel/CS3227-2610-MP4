# Slicing — Agile Platform

Cut from `docs/architecture/` (readiness gate passed 2026-10-29) by `slicing-architecture`. Input to `writing-specs-lite`: a spec cites contracts by anchor and does not restate them. Endpoint numbers are those of `contracts.md`; R-numbers are the requirements of architecture §2; owners follow AD-72 (role of the member). Tier = suggested ceremony (AGENTS.md § 3).

| Workstream | Realises (architecture anchors) | Traces to | Depends on | Areas | Tier / risk | Owner |
|---|---|---|---|---|---|---|
| W1 Foundation and API skeleton | §4, §5 schema, §6, §8; endpoint 1 (health); frozen-first set (A-18) | R3, R6 | none | foundation | Big, high | Dev Lead |
| W2 Gateway runtime and mock | §12, contracts §5.1 and §5.3 (`LlmGateway.run`, `Sessions`), AD-59 | R1, R3, R5 | W1 signature | llm-gateway | Big, high | Developer |
| W3 Guards | §7 pipeline additions, AD-25 | R3 | W2 | llm-gateway | Big, high | Developer |
| W4 Auth and registration | §7, §9.1; endpoints 2, 3, 4 | R3 | W1 | auth | Big, high | Developer |
| W5 Core planning | §5, §11; endpoints 5, 6, 7, 9, 10, 12, 13, 16, 17, 20-24, 33 | R1, R6 | W1, W4 | core | Big | Dev Lead |
| W6 AI context assembly | contracts §5.2, A-08, AD-56 | R3, R5 | W1; W5 for membership | llm-gateway | Big, high | Developer |
| W7 PM plan flow | §9.2; endpoints 34, 35, 37, 40, 41 | R1 | W2, W3, W5, W6 | pm, core | Big | PM |
| W8 Dev Lead facts and digest | §9.3, §11; endpoints 42, 44, 45 | R1 | W2, W3, W5 | lead | Big | Dev Lead |
| W9 Developer upload, summaries, standup | §9.4; endpoints 49-52, 55 | R1 | W2, W3, W5, W6 | dev | Big | Developer |
| W10 UI mockups and shell | §13, AD-71, AD-01b | R1, R6 | none (flows link after W5) | web | Big | PM |
| W11 Security corpus and authorisation tests | §7 verification, AD-26 | R3 | W1, W3 | foundation, llm-gateway | Big, high | Dev Lead, reviewed by Developer |
| W12 CI and process security | §14 (AD-32, AD-53); A-17 once decided | R3 | W1 | none (repo) | Medium | Dev Lead |
| W13 Environments, seed data and deployment | §14, AD-29, AD-53; G-26, G-28, G-32, G-33 | R4 | W1 | foundation | Big | repo owner |
| W14 Sprints, velocity and re-plan (Tier 2.1) | §11; endpoints 27-32, 46-48 | R1 | W5, W8 | core, lead | Big | Dev Lead |
| W15 Usage views (Tier 2.2) | contracts endpoints 56, 57 | R5 | W2 | llm-gateway, web | Medium | PM |
| W16 Tier 2 remainder | endpoints 53, 54, 38, 39, 43, 36, 8, 11, 14, 15, 18, 19, 25, 26 | R1 | W5, W7, W9 | pm, lead, dev, core | Medium | per owner |
| W17 Experiments and telemetry evidence | AD-23b, AD-31, G-23 | R5 | W7, W8, W9 | llm-gateway | Medium | all |
| W18 Reflection document | R7 | R7 | W17 | none (docs) | Small | all |

## Findings

- Not a clean vertical cut: W1, W2, W3, W4, W6 and W13 are platform pieces other slices consume. They cannot be vertical because every role slice needs them first (AD-11, A-18).
- Architecture with no home of its own, assigned here: seed and demo data (§5, AD-28) and the migration approach (G-28) go to W13; the telemetry aggregation script (AD-31) to W17.
- Every endpoint 1-57 appears once: Tier 1 is 32 (W1, W4, W5, W7, W8, W9), Tier 2 is 25 (W14, W15, W16).
- Workstreams that cite no architecture: none.
