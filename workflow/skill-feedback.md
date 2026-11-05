# Skill Feedback

Bounds or flows that did not fit (project-state skill, skill-feedback.md). The operator decides; changes are made at user level and re-synced.

| Date | Skill / limit | Issue | Evidence | Suggested revision | Status |
|---|---|---|---|---|---|
| 2026-11-04 | drafting-interfaces | interface-drafter writes only src/**, but a stub for a new workspace package must add a root tsconfig.json reference and updates package-lock.json | W4 stubs created src/be/auth; ws verify-scope interface-drafter flagged tsconfig.json and package-lock.json | allow tsconfig.json and package-lock.json when a new src/be/* package is created | Open |
| 2026-11-03 | writing-specs-lite | Plan lint rejects completed Create rows while the task is still In progress | T6 implementation files now exist, but plan lint --approved reports Create path already exists before T6 can be marked Done | Allow Create rows for the active task after their checklist implementation step is ticked, or provide a completed-task reconciliation mode | Open |
