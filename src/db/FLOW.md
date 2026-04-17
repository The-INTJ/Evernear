# Database Flow

## Status
MVP now

## If you landed here first
Read [README.md](./README.md) first, then [FOR_HUMAN_CODE--DOC.md](../../FOR_HUMAN_CODE--DOC.md). This file describes the expected data path rather than the folder boundary.

## Parent reads
- [README.md](./README.md)
- [FOR_HUMAN_CODE--DOC.md](../../FOR_HUMAN_CODE--DOC.md)
- [ADR-002](../../docs/adr/ADR-002-sqlite-first-with-portability.md)
- [ADR-006](../../docs/adr/ADR-006-event-sourced-document-and-metadata-history.md)

## Owns
- The narrative of how a local project becomes a live runtime store.

## Does not own
- Full schema details.
- Final API names.

## Flow
1. Main receives a project-open intent and resolves the local project path.
2. The database bootstrap opens or initializes the SQLite store for that project.
3. Repositories expose typed access to project, document, entity, matching-rule, slice, slice-boundary, annotation, history, and layout data.
4. Every mutation appends to the event log, the document step log, or both, then updates projections inside the same SQLite transaction.
5. Main and preload expose approved operations to the renderer through shared contracts.
6. Renderer reads and writes through those contracts rather than touching persistence directly.
7. Export and package operations produce author-portable output from the canonical store, including logs and checkpoints.

## Decided
- The renderer should never know about SQL or direct file layout.
- The write path is append then project, not projection-only mutation.

## Open
- Whether first-run bootstrap should create a full project package immediately or lazily.

## Deferred
- Background indexing or analytics pipelines.
