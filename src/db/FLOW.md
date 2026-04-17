# Database Flow

## Status
MVP now

## If you landed here first
Read [README.md](./README.md) first, then [FOR_HUMAN_CODE--DOC.md](../../FOR_HUMAN_CODE--DOC.md). This file describes the expected data path rather than the folder boundary.

## Parent reads
- [README.md](./README.md)
- [FOR_HUMAN_CODE--DOC.md](../../FOR_HUMAN_CODE--DOC.md)
- [ADR-002](../../docs/adr/ADR-002-sqlite-first-with-portability.md)

## Owns
- The narrative of how a local project becomes a live runtime store.

## Does not own
- Full schema details.
- Final API names.

## Flow
1. Main receives a project-open intent and resolves the local project path.
2. The database bootstrap opens or initializes the SQLite store for that project.
3. Repositories expose typed access to project, document, entity, slice, annotation, and layout data.
4. Main and preload expose approved operations to the renderer through shared contracts.
5. Renderer reads and writes through those contracts rather than touching persistence directly.
6. Export and package operations can produce author-portable output from the canonical store.

## Decided
- The renderer should never know about SQL or direct file layout.

## Open
- Whether first-run bootstrap should create a full project package immediately or lazily.

## Deferred
- Background indexing or analytics pipelines.
