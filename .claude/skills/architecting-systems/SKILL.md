---
name: architecting-systems
description: Use when planning or reviewing a system's or service's architecture before writing a spec or code - choosing components, data stores, interfaces, service boundaries, or async processing, when a team must make or record design decisions, or when an existing architecture document has drifted, contradicts itself, or leaves gaps that block implementation.
---

# Architecting Systems

## Overview

An architecture plan is finished when it makes the system's **data, interfaces, permissions, state transitions and failure behavior explicit**, and when every choice in it can be traced to someone who made it. A plan that only describes the intended system is not finished.

You (the AI) research options, analyse them and recommend one. **The team decides.** The plan must always show which is which.

This skill sits before spec writing and implementation planning (e.g. superpowers:brainstorming, superpowers:writing-plans). The output is an architecture document that has passed the readiness gate, written to `docs/architecture/` (split by concern: overview, contracts, concerns, `decision-log.md`, delivery plan). **Decision IDs are `AD-nn`** (never `D-nn`, which is a project-state Deviation). When the gate passes, hand off to `slicing-architecture`, and re-invoke this skill in review mode when a spec raises a gap back (a spec that finds an architecture gap raises it here as a new Gap, never as a silent spec decision).

## When NOT to use

- A single-component change inside an existing, documented architecture. Use brainstorming or spec writing instead.
- Recording one technology choice in isolation. A single ADR is enough (engineering:architecture).

## Profiles: load the ones that match

| Project shape | Read |
|---|---|
| Anything served over HTTP | `profiles/web-service.md` |
| Several independently deployed services | `profiles/web-service.md`, then `profiles/microservices.md` |
| One deployable web app with internal modules | `profiles/web-service.md`, then `profiles/monolith-web.md` |
| CLI tool, batch job, or data pipeline | `profiles/cli-and-pipelines.md` |
| Something else | Core only. Translate the web profile's checklists by analogy |

Profiles add checklist items and contract formats. They never replace the core process.

## Status vocabulary (use it everywhere)

| Status | Meaning | Who sets it |
|---|---|---|
| **Given** | A fixed constraint: the brief, an existing system, law, or something the team states is non-negotiable. Record its source. | Source |
| **Gap** | A decision is needed and not yet analysed | Anyone |
| **Proposed** | AI options and a recommendation, awaiting the team | AI |
| **Decided** | The team chose between alternatives, including adopting their own convention or accepting your recommendation | Team only |
| **Assumed** | A temporary premise used to make progress; lists what depends on it and when it must be confirmed | Team. You may suggest one; it becomes Assumed only when the team agrees, or under delegation (below) |
| **Deferred** | Decided later; states what it blocks | Team |
| **Out of scope** | Owned elsewhere or deliberately excluded | Team |

**The core rule:** untagged content in the document body may rest only on Given, Decided or Assumed items. A Proposed item lives in its decision brief. Never write the rest of the design as if your recommendation were already chosen. If body text must depend on an undecided choice (an inherited draft, or a workflow sketched to show a trade-off), tag it inline `[Proposed: AD-nn]`, and rewrite it when the decision lands. In a new document, prefer not writing that text yet.

If the team answers only part of a bundled decision, split it (AD-06 → AD-06a, decided, and AD-06b, still open). Don't hold back the answered part.

## Process

1. **Frame** (one short round of questions). Ask about anything the team hasn't already told you:
   - what the system owns, and what it explicitly does not own
   - its users and roles
   - its external dependencies and who owns them; ask for the source or docs of existing contracts
   - its requirements and how they'll be verified or graded
   - stack constraints and preferences
   - deadline
   - **rules on AI use**: whether you may recommend, or only compare.

   Read the existing code and documents first, and don't ask what they already answer. **Wait for the answers before writing any decision brief.** The answers about AI rules and stack constraints change what a brief may contain.
2. **Skeleton.** This can happen in the same turn as framing. Create the document from `reference/document-template.md` (or adopt an existing document, see below). Sections start as Gap. Fill in only what's Given: scope, and the requirement traceability table.
3. **Gap inventory.** List every decision the design needs, with its dependencies. Mark it preliminary if framing is still open. Order the decisions by what they unblock: foundations (boundaries, data store, contract style) before details (field names, retry delays). Group them into **rounds** of about 3–6 related decisions.
4. **Decision round.** For each decision, write a brief (format below) and present the round. Use AskUserQuestion for compact choices; put heavier briefs in the document and summarise them in chat. **Stop and wait.** Don't brief the next round in the same turn.
5. **Record and propagate.** Turn each answer into a decision record. Then update **every** artifact the decision touches: schema, interface tables, examples, diagrams, workflows, traceability, and the gap list. A new decision often reveals new gaps. Add them to the inventory.
6. **Lens pass.** Once the foundations are Decided, walk through `reference/checklists.md` (the core checklist plus each loaded profile's) to find gaps that the rounds didn't surface. Failure paths, async jobs, time and derived values, and error mapping are the usual misses.
7. **Consistency audit.** Run it after every round that changed names or structure, and always before the gate (`reference/checklists.md` § Audit).
8. **Readiness gate.** Classify each remaining gap by what it blocks: implementation, integration, deployment. Declare the plan ready only when the gate passes. Then hand off to spec writing.

## When the team delegates ("just write it all, we'll skim it")

The team may skip rounds; it's their call. Don't refuse, and don't quietly run only round 1. Keep the rule that makes this skill worth using: **the document always shows who chose what.**
- Write the full draft, with field-level contracts. Mark each of your choices **Assumed (AI default, delegated <date>)**, and give each its brief in the decision log. Nothing becomes Decided without an explicit reply.
- Put a **sign-off sheet** at the top: policy choices, choices that are hard to reverse once data or integrations exist (identity and dedup keys, data store, contract shape), and blockers you need from them (sample data, contract sources). Keep it to the 5–8 items that matter.
- Offer a one-line bulk reply: "accept all defaults except AD-xx". Record what they accept as Decided, "accepted AI recommendation".
- The readiness gate can't pass while sign-off items are still Assumed.

## Adopting an existing document

- Keep its section numbers so the team's references still work.
- Relabel its items with this vocabulary. Inherited recommendations become Proposed, with an inline `[Proposed: AD-nn]` tag wherever the body depends on them.
- Add the template sections it lacks as Gaps.
- Remove "spec-level detail" deferrals. They belong in the readiness gate as open items.

## Decision brief format

```markdown
### AD-07 <short name> — Proposed
Why now: <what it unblocks; what depends on it (AD-03, §5 schema)>
| Option | Pros | Cons | Choose when |
|---|---|---|---|
Recommendation: <option>, because <reason tied to this project's requirements and constraints>.
Confidence: high / medium / low. What would change it: <fact or preference>.
Evidence: <sources for version, pricing, limit or behavior claims; mark anything unverified>
```

Once the team answers, rewrite it as: **Decision · Reason · Consequences · Dependencies · Open questions · Decided by** (team, date; "accepted AI recommendation" or "team's own choice").

- Give 2–4 real options. A strawman isn't an option. If the team states a preference you didn't list, analyse it with the same rigor.
- "You choose" from the team still counts as a Decided record: "accepted AI recommendation". Never record it silently.
- Product or policy questions (cancellation rules, visibility, quotas) are the team's. Recommend a default, but flag it as policy.
- If the team's rules forbid AI-proposed decisions, keep analysis to facts and comparisons and leave the Recommendation line out.

## Contracts, not descriptions

Write every interface (HTTP endpoint, CLI command, event, file format, module API) at **field level**: inputs, outputs, types, an example, errors, side effects, and who may call it. "Returns room info" or "exact fields belong in the spec" means the plan isn't finished. Field-level contracts are the architecture. The spec adds feature behavior and acceptance criteria on top of them.

Errors need two separate things: a **shape** (envelope, exit-code scheme), and a **mapping** from each condition and operation to an exact code. "422 means validation failure" is the code's literal meaning. "A missing category gives 422 on this endpoint" is a project decision. Record each mapping as a decision.

## Readiness gate

| Gap | Blocks implementation? | Blocks integration? | Blocks deployment? |
|---|---|---|---|

The plan is ready when:
- every requirement traces to a component, a contract and its verification evidence
- the schema and contracts are concrete
- roles are mapped to operations
- error shape and mapping are defined
- normal and failure flows exist for every important workflow
- async jobs have payload, retry, idempotency and dead-letter decisions
- external contracts are confirmed or explicitly mocked
- nothing left open blocks the first implementation slice.

## Red flags: stop and correct

- Writing the full document, with all decisions "recommended", before the team has answered anything, unless they explicitly delegated (then use delegation mode)
- Writing decision briefs before the framing answers arrive
- Body text that assumes a Proposed choice ("the Postgres exclusion constraint guarantees…")
- "Field names, JSON schemas and error messages are spec-level details"
- A status-code list with no mapping from condition to code
- "Retry on failure" with no attempt count, backoff, idempotency key or dead-letter destination
- Only one readiness criterion, e.g. "nothing blocks the spec"
- A decision changed in one section while stale names survive in examples or diagrams
- Technology claims (limits, pricing, feature support) without a source

## Common mistakes

| Mistake | Fix |
|---|---|
| One huge pass of 18 recommendations | Rounds in dependency order; wait between them |
| Assumption silently treated as a decision | Mark it Assumed, list what depends on it, get the team's sign-off |
| Layer diagram without responsibilities | Owns / Must-not-own table, plus dependency direction |
| Schema lists table names only | Keys, nullability, uniqueness, indexes, lifecycle, stored vs derived |
| Only the happy path | Failure matrix per workflow step |
| Provider SDK details in business logic | Stable interface; provider details go in deployment notes |
| A revision patched in one place | Propagate it, then run the audit |
