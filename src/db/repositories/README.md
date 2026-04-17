# Repositories

## Status
MVP now

## If you landed here first
Read [src/db/README.md](../README.md) first, then [src/shared/domain/README.md](../../shared/domain/README.md). Repositories are where schema details become usable application-level operations.

## Parent reads
- [src/db/README.md](../README.md)
- [FOR_HUMAN_CODE--DOC.md](../../../FOR_HUMAN_CODE--DOC.md)
- [src/shared/domain/README.md](../../shared/domain/README.md)

## Owns
- Query and write operations grouped by domain aggregate.
- Transaction boundaries.
- Mapping between SQL rows and shared domain shapes or DTOs.

## Does not own
- IPC.
- React-facing view models.
- Raw schema design decisions in isolation.

## Likely repository areas
- `ProjectRepository`
- `DocumentRepository`
- `EntityRepository`
- `SliceRepository`
- `AnnotationRepository`
- `WorkspaceRepository`

## Key relationships
- Repositories should hide SQL details from the rest of the app.
- They should return concepts the rest of the code already understands from `shared/domain`.

## Decided
- Repository boundaries are worth naming early so storage complexity does not bleed upward.

## Open
- Whether matching queries live inside `EntityRepository` or in a dedicated read-service layer.

## Deferred
- Heavy CQRS-style separation unless the codebase actually needs it.
