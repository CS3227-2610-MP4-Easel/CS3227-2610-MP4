---
name: drafting-interfaces
description: Use when a Big spec is approved and tests will be written before implementation, to create compilable interface stubs (signatures, DTOs, NotImplemented bodies) from the spec's api and data-model contracts, before planning and blind test authoring.
---

# Drafting Interfaces

Stubs give blind tests something to compile against, so a test fails for the right reason.

1. Read only the spec's `api.md`, `data-model.md`, and the conventions for file layout.
2. Create one stub file per component the contract names: signatures, DTO/record types, error
   types, constants. Bodies throw `NotImplemented` (or the stack's equivalent). **No logic.**
3. Run the build (`ws test` or the project build); it must compile. A stub that does not compile
   blocks test authoring.
4. Return the list of stub files and the build result. Commit alone: `feat: interface stubs for <topic>`.
5. Write only to the paths the `interface-drafter` role allows; check with `ws verify-scope interface-drafter`.

Red flags: filling in a body "to be helpful"; inventing a signature the spec does not state (raise
it as a spec ambiguity instead); touching tests.
