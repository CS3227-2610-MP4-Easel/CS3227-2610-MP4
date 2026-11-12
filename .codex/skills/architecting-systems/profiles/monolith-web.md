# Profile: monolith web app

Load after `web-service.md`. A single deployable with internal modules. Module boundaries take the place of service boundaries, so they need the same discipline even though the compiler or runtime won't enforce them.

## Decide and state
- **Module map:** each module's owned data (tables or schemas), its public interface, and the modules it may call. A table belongs to exactly one module.
- **Dependency rules:** allowed directions between modules, and how they're enforced (lint rules, package visibility, architecture tests, or "review only" *as a decision*)
- **Cross-module calls:** direct function calls through a module's public interface, or in-process events. Never reach into another module's tables or internals.
- **Transactions:** a single database means cross-module transactions are possible. Decide whether they're allowed or whether modules stay transactionally independent (which keeps a later split into services possible).
- **Background work:** an in-process scheduler or queue vs an external queue. Even in-process jobs need the core async decisions: retries, idempotency, and what happens on a crash mid-job or a redeploy.
- **Rendering model:** server-rendered pages, SPA plus JSON API, or hybrid. This decides whether §6 is an HTTP JSON contract, a page/form contract, or both.

## §6 Contracts
Write module public interfaces at field level, just as you would endpoints: operation, inputs, outputs, errors, side effects. For server-rendered pages, the contract is the form fields, validation rules, and redirect or error rendering for each route.

## Checklist
- [ ] Each table is owned by one module, and no module queries another's tables
- [ ] The session or auth mechanism (cookies, CSRF protection, session store) is decided, for server-rendered flows
- [ ] File uploads and long-running work are kept off the request thread where needed
- [ ] There's a migration strategy for a single shared schema (ordering, backwards compatibility during a deploy)
- [ ] Scaling assumption: a single instance, or several behind a load balancer (affects sessions, schedulers, in-memory caches)

## Diagrams
Module dependency diagram (showing allowed directions) instead of a service context diagram, plus the usual ERD and sequence diagrams.
