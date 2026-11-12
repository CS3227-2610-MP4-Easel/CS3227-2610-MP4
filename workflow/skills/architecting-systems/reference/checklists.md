# Lens checklists and consistency audit

Use these during the lens pass (process step 6) to find gaps. Each unanswered question becomes a Gap in the inventory. Don't answer them yourself in the document body; brief them as decisions.

## Core lenses (every project)

**Scope and requirements**
- Does every requirement map to a component, a contract and its verification evidence?
- Is ownership explicit for every piece of data and behavior, including what is *not* owned?

**Context**
- Does every dependency have an owner, a contract status and a known impact if it fails?
- Are mocked or assumed contracts marked Assumed, with the date and owner who will confirm them?

**Boundaries**
- Does any behavior have two owners, e.g. validation in both the UI and business layer, with only one authoritative?
- Can an outer layer bypass an inner one, e.g. UI to database, or one service writing another's store?

**Data**
- Can every interface input field be traced to a stored field or to an explicit workflow?
- For each entity: what is its delete lifecycle, what happens to its dependents, and can it be restored?
- Which fields are stored and which are derived? Which are server-managed and which come from the client?
- What concurrency control is there for concurrent edits (optimistic version, locks, last-write-wins *as a decision*)?

**Interfaces**
- Does every operation have a field-level input and output, an example, errors and side effects?
- Are names consistent across the schema, contract tables, examples, diagrams and prose?

**Permissions**
- Is the role × operation matrix complete? Is it enforced by the system itself, not by "the UI hides the button"?
- Are ownership checks (a user acting on their *own* resource) placed in one layer?

**Errors**
- Is there a shape, plus a mapping for every condition and operation?
- Is the boundary between malformed input and invalid values decided?

**Workflows and failure**
- For every workflow with more than one step or system: what happens when each step fails?
- What does the user see while a workflow is partly complete?

**Async**
- Does every job have a producer, consumer, payload, idempotency key, retry policy, dead-letter destination and ordering requirement?
- What happens on commit-then-enqueue-fails, on duplicate delivery, on a target already gone (e.g. the file was already deleted), and on retries running out?

**State, time, derived values**
- Is there a state table for each stateful entity, including the terminal states and the "retries exhausted" outcome?
- Are time zone, clock source, interval inclusivity, overnight, 24-hour and missing-data cases defined?

**Providers**
- Are undecided providers behind a stable interface? What is stored, what is returned, and what happens during an outage?

**Operations**
- Does each operational concern have a status (Decided / Deferred / Out of scope / Required before deployment)?

## Consistency audit

Run it after every round that renamed or restructured anything, and always before the readiness gate. Search the document; don't rely on memory.

- [ ] Every operation in the inventory appears in an example, and every example uses the schema's field names
- [ ] Every role in the permissions section matches the operation table
- [ ] Every code used in an example or workflow appears in the error mapping
- [ ] Every entity in the ERD exists in the concrete schema, with the same keys and cardinality
- [ ] Every async workflow has a job row in §10 and a failure matrix in §9
- [ ] Every dependency has an owner and contract status
- [ ] Superseded decisions are marked as such, and their old terms don't appear in the current design. Search for each old name explicitly.
- [ ] No body text rests on a Proposed item
- [ ] The traceability table's Status column matches reality
- [ ] The changelog records this round
