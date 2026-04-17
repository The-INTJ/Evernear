# Source Tree

## Status
MVP now

## If you landed here first
Start with [FOR_HUMAN_CODE--DOC.md](../FOR_HUMAN_CODE--DOC.md), then skim [FOR_HUMAN_BUSINESS--DOC.md](../FOR_HUMAN_BUSINESS--DOC.md). This folder explains how those decisions map onto real code boundaries.

## Parent reads
- [FOR_HUMAN_CODE--DOC.md](../FOR_HUMAN_CODE--DOC.md)
- [FOR_HUMAN_BUSINESS--DOC.md](../FOR_HUMAN_BUSINESS--DOC.md)

## Owns
- The future source layout for the desktop app.
- Runtime boundaries between Electron processes, shared code, and persistence.
- The chain-up rule for all code-facing docs under `src/`.

## Does not own
- Product strategy or priority by itself.
- ADR history.
- Cross-cutting project-process docs.

## Key relationships
- `main`, `preload`, and `renderer` reflect runtime boundaries.
- `shared` carries language and contracts across those boundaries.
- `db` defines how project data is stored and retrieved.

## Likely future code here
- App bootstrap entrypoints.
- Runtime-specific folders with implementation files.
- Shared domain types and contracts.
- Database schema, repositories, and migrations.

## Decided
- The source tree should be real now, not a fake diagram hidden inside one giant markdown file.
- We prefer clear boundaries over early package extraction.

## Open
- When the codebase should graduate from a single-app repo into extracted packages, if ever.

## Deferred
- Separate workspace/package scaffolding.
