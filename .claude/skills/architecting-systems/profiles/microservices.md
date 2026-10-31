# Profile: microservices

Load after `web-service.md`. Usually you're architecting **one service** inside a larger system: keep the document about that service, and treat the other services as dependencies with contracts.

## Boundary rules to decide and state
- **Database per service:** no service reads or writes another's store. Cross-service data moves only through APIs or events.
- **Cross-service references:** which IDs leave this service, and whether they're stable forever (e.g. referenced from another service's history after a soft delete)
- **Data duplication:** what this service caches or copies from others, how it stays fresh, and which copy wins
- **Ownership of shared concerns:** gateway, identity, notifications, file storage. Name the owning team or person for each.

## §3 Dependency contracts
For every other service this one calls or listens to:

| Service | Direction (calls / called by / events) | Operations or events | Contract status | Owner to agree with | Mock plan until it's ready | Impact if it fails |

A contract that's still mocked is **Assumed**: record the assumed shape and the date or milestone when it must be confirmed. Copy existing contracts (role strings, token claims, endpoint shapes) from the other service's code or docs, and cite the file.

## Cross-service consistency
Writes that span services can't share a transaction. For each one, decide:
- **Pattern:** a transactional outbox (an event row written in the same local transaction, published by a relay), a saga with compensating steps, or "best effort + reconciliation" *as an explicit decision*
- **Ordering guarantees** needed (per entity? none?)
- **What the client sees:** a response once the local commit is done, or a wait for downstream confirmation
- **Downstream failure:** which side retries, and where exhausted retries go (a dead-letter table or queue, and who looks at it)

## Async contract (template §10, required here)
- Job or event envelope, e.g. `{id, task_name/type, payload, version/occurred_at}`
- Queue names and how they map to the queue technology
- Retry policy: max attempts, backoff schedule, which errors aren't retryable (bad payload, unknown type → straight to dead-letter)
- Idempotency for consumers: the key, and how a redelivered job is detected
- Relay or outbox mechanics: polling interval, ordering, when the row is deleted or marked done
- Worker lifecycle: a separate process or container, shutdown behavior (finish the active job?)

## Checklist
- [ ] Every outbound call has a timeout and a defined failure behavior
- [ ] Every event this service emits has a versioned schema and a named consumer
- [ ] Every event it consumes has an idempotent handler
- [ ] Commit-then-publish failure is covered (outbox, or a documented risk)
- [ ] Gateway routing, path prefixes and same-origin vs CORS are agreed with the gateway owner
- [ ] Local development: how dependencies are mocked or run (compose, stubs), with the same interfaces as production

## Diagrams
Add a queue workflow diagram (producer → store/outbox → relay → queue → worker → downstream services, with retry and dead-letter branches) and a state diagram for any entity whose lifecycle triggers events in other services.
