# 7. Testing

Front end only, from `src/fe`:

| Command | Checks |
|---|---|
| `npm run lint` | no import of `api/fixtures` or `api/store` outside `lib/api` |
| `npm run typecheck` | TypeScript |
| `npm run build` | production build |
| `npm run smoke` | with the dev server running, every route listed on `/screens` returns 200 for each role |
| `npm run linkcheck` | no dead link; every screen is reachable for each role |
