---
name: authoring-tests
description: Use when a Big or High-risk spec has interface stubs and needs independent contract tests written from the spec alone, before implementation, so tests do not inherit the implementer's misreadings. Covers blind test authoring and the red-tests commit.
---

# Authoring Tests (blind contract tests)

Two test layers exist. **Layer 1** is ordinary TDD inside each plan task, owned by the implementer.
**Layer 2** (this skill) is blind contract tests for the public contract: API behaviour,
permissions, money and state transitions, edge-case rows. Required for High risk and for tasks the
spec marks `critical`; recommended for Medium with a contract; skipped for Small and Low.

## Flow

1. Starts after spec approval and stub review, in parallel with plan review (tests derive from the
   spec and stubs, not the plan, so a reworked plan wastes nothing).
2. One `test-author` subagent per task or wave. It sees: spec components, stubs, edge-case rows,
   the test conventions pack, `[contract]`-tagged plan snippets. It never sees `[impl]` snippets or
   implementation.
3. Each test cites an `E` or `F` ID. Tests live apart (`tests/contract/` or a `*.contract.test`
   suffix).
4. Confirm every test fails for the right reason (compiles, then fails on `NotImplemented`).
   Commit as `test: red contract tests for <topic>`; the plan approval covers the test list.
5. A tester-lens reviewer checks that every E row has a test.

## Rules

- The implementer may add its own tests but may not edit or delete contract tests. If it believes
  one is wrong it stops and records a Deviation; the spec or test changes through change control.
- A disagreement between an independent test and the implementation is **spec ambiguity found**,
  a useful signal, not a process failure.
- Fixtures are the main risk: the conventions pack must name shared base classes, builders and
  seeds. Allow one clarification loop to the planner.
- Verify scope with `ws verify-scope test-author`.
