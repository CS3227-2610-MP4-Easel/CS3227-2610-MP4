# Profile: web service (anything served over HTTP)

Adds to the core. Specialises template sections 6–8 and 13.

## Typical first-round decisions (foundations)
- Contract style (REST / RPC / GraphQL) and where the contract lives (the doc's tables, or an OpenAPI file referenced from the doc)
- API versioning (path prefix, header, or none)
- Data store type and engine
- Authentication source (own, existing identity service, external provider) and token format
- Error envelope shape
- Deployment topology for the browser: same origin via a gateway or reverse proxy, or cross-origin with CORS

## §6 Interface contract: per endpoint
| Field | Content |
|---|---|
| Method + path | `GET /api/v1/rooms/:id` |
| Caller roles; authentication required? | |
| Path / query parameters | name, type, required, default, allowed values |
| Body | JSON fields or multipart parts, with types; which fields are server-managed and so rejected or ignored |
| Success response | status code plus field-level body (and its envelope, e.g. `metadata` + `data`) |
| Error responses | codes from the §8 mapping |
| Side effects | store writes, jobs enqueued, files stored |
| Example | a full request and response |

Also decide, for list endpoints:
- **Pagination:** page or cursor, the size and whether clients can change it, and what a page past the end returns
- **Filtering:** which filters, and whether they take IDs or free text
- **Search:** which fields are matched, case sensitivity
- **Sorting:** allowed keys, default
- **Visibility:** which records each role sees, e.g. soft-deleted or inactive records

## §7 Permissions
- Token: issuer, signing algorithm, where it's verified (locally or via an introspection call), claims used, and the exact role literals. Copy these from the identity service's source or docs, not from memory; mismatched literals are a common integration bug.
- Role × endpoint matrix, including read-only and reference endpoints
- Behavior for missing or invalid tokens vs a valid token with the wrong role. Also decide whether another user's resource returns 403 or 404 (a 404 doesn't reveal that the resource exists).

## §8 Errors
- Envelope example, e.g. `status_code`, `error`, `message`, `timestamp`, `details[{field, location, message}]`, or RFC 7807 problem+json with a machine-readable `code`
- Mapping table columns: condition → endpoint(s) → status → message / details. Decide explicitly:
  - 400 vs 422 (malformed vs invalid value)
  - 404 for soft-deleted resources
  - 409 uses (version conflict, duplicate, idempotency key still in flight)
  - 429
  - which 5xx errors are returned synchronously and which failures are absorbed into queued work

## Cross-cutting checklist
- [ ] **Concurrency:** optimistic `version` column (who sends it, and what conflict code) or locking
- [ ] **Idempotency:** which `POST`s need an `Idempotency-Key`; the cache scope (per user?), how long it's kept, and what a replay returns while the original is in flight vs after it completes
- [ ] **Uniqueness and duplicates:** natural-key constraints, and how they interact with soft delete (re-create = restore?)
- [ ] **Rate limiting:** a limit per what (IP, user), and the response
- [ ] **Uploads:** accepted types, size and count limits, multipart parsing, where binaries go, and what reference is returned (signed URL and how long it lasts?)
- [ ] **Time:** server time zone for stored and derived timestamps
- [ ] **Health and readiness endpoints:** Decided or Deferred

## §13 Consumer / UI integration
For each screen: the endpoint(s) that populate it, the fields shown, and its loading, empty, error, unauthorized and forbidden states. Also: when reference data (filter options) is loaded, edit and delete confirmation, and whether the data is live or mocked. The service must be usable through its API without the UI.

## Diagrams
Context, layers, ERD, a sequence diagram per important endpoint flow, and a failure sequence for any flow involving storage, a queue, or another service.
