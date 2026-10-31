# Worked Examples

The template gives you the shape. This gives you the bar. Every pair below is the same fact
written badly and written well — the difference is whether a cold agent can act on it.

## Next Action (per session)

> ❌ Continue work on the conflict engine.

Useless. Which part? Where? What counts as done?

> ✅ Implement `computeAvailability()` in `lib/conflicts.ts` — Task 6 of the W1 plan, the first
> unchecked one. Peak-concurrent algorithm is specified in spec §5.3; the sweep-line shape is in
> the plan. Tests exist and fail: `npm test -- conflicts`.

Names the file, the task, where the algorithm is defined, and how you know when it works. This is
the single most damaging field to leave vague — it is what a cold session reads first. It lives
in each session row's **Next action** cell, one per session.

## Decision (provisional, in §7 of the branch state)

> ❌ | C~1 | 2026-09-16 | Conflicts warn instead of blocking | Discussed with user |

Records the outcome and loses everything that makes it a decision.

> ✅ | C~1 | 2026-09-16 | Conflicts warn and can be overridden; the event is flagged | Operator
> ruled out hard blocks — bookings get resolved out-of-band by phone, and a hard block would push
> users into entering fake data to get past it. Overriding must stay one click | spec §3 |

The *why* is what stops a future agent "improving" this into a hard block. Record the rejected
option, not just the chosen one. At fold this becomes `decisions/C14.md` (or whatever number is
next) with these same fields.

## Deviation (provisional, in §8 of the branch state)

> ❌ Had to change the availability query, Prisma was being difficult.

Nobody can act on this, and in three weeks nobody will remember what "difficult" meant.

> ✅ **D~2 — availability is a raw SQL sweep, not a Prisma aggregate (Task 6)**
>
> The plan's `groupBy` approach sums quantity across the whole window, which reports conflicts
> that do not physically exist — spec §5.3 requires *peak concurrent* usage. Prisma has no
> window-function support, so `computeAvailability()` uses `$queryRaw` with a sweep over
> reservation start and end events.
>
> Consequence: this query is not type-checked by Prisma. `tests/conflicts.peak.test.ts` pins the
> behaviour — if you change the schema, that test is the guard.

States what changed, why the documented approach was wrong, and what it costs you later. At fold
this becomes `deviations/D7.md` verbatim, just renumbered.

## Changes Line — Small Change

Small changes are recorded too. They just get one line, copied into the Done ledger at fold.

> ❌ | 2026-09-17 | Fixed a bug | — | — |

> ✅ | 2026-09-17 | Buffer minutes were applied to the event end only, not the start, so
> overlapping pickups stopped warning. Fixed in `lib/conflicts.ts` | W1 | `a3f1c02` |

No spec, no plan, no ceremony — but the behaviour changed, so it is written down. If the fix had
contradicted the spec rather than implementing it, it would need a Deviations entry too.

## Workstream Row

> ❌ | W~1 | Reservations | Finished | spec | plan | Going well, docs updated | Yes |

> ✅ | W~1 | Inventory reservation MVP | In review | spec | plan | All 9 tasks done; see D~2 | — |

`In review` and `—` come from fixed vocabularies, so they grep; "Finished" and "Yes" do not. A
branch's Guide cell always stays `—` (or `N/A`), never a guess at what sync will set.

## Progress Cell

> ❌ Implemented the sweep-line engine after we found that the Prisma aggregate summed across
> the window, which the operator agreed was wrong; tests for buffers and adjacency all pass, now
> starting the API route but the database credentials still are not available.

Four facts buried in fifty words, and three of them belong elsewhere.

> ✅ Task 7/20 in flight: availability API. See D~2, Q~2

The position, what is in flight, and pointers. The sweep-line story is D~2; the credentials are
Q~2; "tests pass" is the Changes line's job.

More shapes, all acceptable:

> ✅ Tasks 1–6 done; Task 7 next
> ✅ Task 3/8 stopped: Q~2
> ✅ Spec approved 2026-09-16; plan not started
> ✅ All 20 tasks done; manual checks pending

## Session Row

> ❌ | S2 | 09-19 | Claude | — | Active | Working on stuff | continue | 09-19 |

Tells a resuming session nothing: which workstream, what "stuff", what "continue" means, and a
bare date cannot be checked against `git log` to tell whether the row is stale.

> ✅ | S2 | 2026-10-19 14:02 | Claude Sonnet 5 (lead) + Explore×2 | W~1 | Active | Task 3/6: gap
> review | Fix the conflict text in `EventDetails.tsx`; done when `npm test -- details` passes |
> 2026-10-19 15:40 |

Names the workstream, a position in the plan, the agent mix, a **Next action** a cold agent can
start on, and a timestamp precise enough to judge staleness during reconciliation.

## Remaining and Handover

> ❌ - [ ] Clean up some stuff later

> ✅ - [ ] **Handover:** Add the CSV export. Needs its own spec first (format and column order
> undecided); done when a spec is approved. Context: the items table already exposes `toRows()`
> in `lib/items.ts`.

Marked **Handover**, so sync copies it into `STATE.md` §2 → Upcoming, and written so someone who
never saw this branch can act on it.

## Architecture Block

> ❌ (in a flat decisions table, nothing else)
>
> | C~1 | 2026-09-16 | Workspace tenancy from day one | Operator wanted organisations to be additive later | spec D4 |

A true entry that never says what the system does now.

> ✅ **### 4.2 Tenancy & auth**
>
> **Now (proposed):** Every user gets one workspace on first sign-in; the word never appears in
> the UI. `requireSession()` in `lib/workspace.ts` is the only place a workspace is resolved —
> it returns `{ userId, workspaceId }` or redirects to `/login`.
>
> | Path | Role |
> |---|---|
> | `lib/workspace.ts` | `requireSession()` — the only workspace resolution |
>
> | ID | Date | Decision | Why / who asked | Source |
> |---|---|---|---|---|
> | C~1 | 2026-09-16 | Workspace tenancy from day one, one auto-created workspace per user | Operator: adding organisations later becomes "allow a second member", not a data migration | spec D4 |

At fold this block replaces (or becomes) `architecture/tenancy.md`'s Now, and the decision row
becomes its own `decisions/C<n>.md`, linked from that area's Decisions table.

## The Shared Tell

Every bad example above is shorter than the good one and reads like a note to yourself. Every
good one reads like a note to a stranger who has your job tomorrow and none of your memory.

Write for that stranger. It is you.
