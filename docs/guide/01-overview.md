# 1. Overview & Scope

A web app for Agile scrum teams: projects, epics, tasks, checkpoints and sprints, with one AI feature per role (PM plans, Dev Lead digests and re-plans, Developer standups). Full target design: [architecture](../architecture/agile-platform-architecture.md).

**Built so far (W10):** the web front end in `src/fe` for the three roles (Project Manager, Dev Lead, Developer). It reads and writes through a data layer that currently runs in the browser; the backend replaces that layer later without touching the screens.

**Out of scope here:** the plan screens still use sample data until W7 lands the plan flow.
