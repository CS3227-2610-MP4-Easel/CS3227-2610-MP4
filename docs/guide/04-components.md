# 4. Components

Front end only. What this workstream added to `src/fe`:

- `app/[[...slug]]/page.tsx`: one catch-all route. `lib/screens.ts` maps each URL to a screen per role.
- `app/api/as`: sets the role cookie.
- `components/canvas/`: the page layouts, one per screen and role.
- `components/live/`: the parts that read and write through the data layer (board, backlog, sprints, members, checkpoints, health, standups, usage, task drawer).
- `lib/api/`: types, fixtures, store and the endpoint-named functions (see section 3).
