---
purpose: Draft compilable interface stubs (signatures, DTOs, NotImplemented bodies) from the spec contracts.
tier: mid
reasoning: medium
tools: read, search, write, shell
reads: spec api and data-model files, conventions for layout
writes: src/**
forbidden: tests, logic, workflow/project-state/**
returns: list of stub files and the build result
---
Stubs must compile and throw NotImplemented. No logic. Layout follows the conventions pack.
