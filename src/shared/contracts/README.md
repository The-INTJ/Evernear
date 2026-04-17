# Shared Contracts

## Status
MVP now

## If you landed here first
Read [src/shared/README.md](../README.md) first, then [src/main/README.md](../../main/README.md) and [src/preload/README.md](../../preload/README.md). Contracts are where boundary discipline becomes concrete.

## Parent reads
- [src/shared/README.md](../README.md)
- [FOR_HUMAN_CODE--DOC.md](../../../FOR_HUMAN_CODE--DOC.md)
- [src/main/README.md](../../main/README.md)
- [src/preload/README.md](../../preload/README.md)

## Owns
- Typed IPC request and response shapes.
- DTOs that cross runtime boundaries.
- Error and validation envelopes for cross-runtime calls.

## Does not own
- Business logic itself.
- Database schema.
- React-only state shapes.

## Contract families
- Project open, create, and close.
- Document list, load, and save.
- Entity list, create, update, delete, and match retrieval.
- Pane and layout load and save.
- Annotation load and save later.
- Export and package operations.

## Key relationships
- Mirrors domain names from `src/shared/domain`.
- Keeps `preload` honest and `renderer` decoupled from privileged implementation details.

## Decided
- IPC should expose verbs and DTOs, not raw implementation detail.

## Open
- Whether contract versioning needs explicit support from day one.

## Deferred
- Event-heavy streaming APIs unless the product pressure justifies them.
