# ADR-002: SQLite First with Portability

## Status
Accepted

## Date
2026-04-16

## Parent reads
- [FOR_HUMAN_CODE--DOC.md](../../FOR_HUMAN_CODE--DOC.md)
- [FOR_HUMAN_BUSINESS--DOC.md](../../FOR_HUMAN_BUSINESS--DOC.md)

## Context
Evernear needs structured local storage for documents, entities, matching rules, slice associations, reusable slice boundaries, annotations, and persistent layout state.
The core workflow also benefits from reliable querying and transactions.
At the same time, the product philosophy rejects trapping authors in an opaque or hostile format.

## Decision
Make SQLite the canonical runtime store for a local project.
Treat portability as a core requirement by planning first-class export or package support from the start.
The likely project shape is a local project directory that contains the database and any adjacent asset or export material.

## Consequences
- Querying and consistency become simpler than a purely file-first design.
- Structured concepts such as entities, slices, slice boundaries, and layout state fit naturally.
- We must design export and package behavior intentionally so author ownership remains real.
- The database layer now owns part of the product trust story, not just persistence mechanics.

## Decided
- SQLite-first is not allowed to become user-hostile.

## Open
- Exact project directory and package format.
- Whether export should default to a bundle, plain-text files, or both.

## Deferred
- Remote sync and any network-aware persistence model.
