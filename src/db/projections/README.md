# Projections

## Status
MVP now

## If you landed here first
Read [src/db/README.md](../README.md) first, then [ADR-006](../../../docs/adr/ADR-006-event-sourced-document-and-metadata-history.md). Current-state tables are not canonical truth. The event log, the document step log, and document checkpoints are. This folder explains how the two sides relate.

## Parent reads
- [src/db/README.md](../README.md)
- [FOR_HUMAN_CODE--DOC.md](../../../FOR_HUMAN_CODE--DOC.md)
- [ADR-003](../../../docs/adr/ADR-003-document-persistence-and-editor-state.md)
- [ADR-006](../../../docs/adr/ADR-006-event-sourced-document-and-metadata-history.md)

## Owns
- The projection layer that materializes current-state tables from the event log, the document step log, and document checkpoints.
- Rebuild logic for recovering projected state from scratch.
- Invariants that keep projections consistent with the logs under normal writes.

## Does not own
- Append-only log storage itself — that lives in `schema` and `repositories`.
- Domain vocabulary — that lives in `shared/domain`.
- Renderer-side view models.

## Core idea
Projections are deterministic functions of the event log plus the document step log plus document checkpoints. Mutations always commit as append-then-project inside a single SQLite transaction. If a projection drifts or its shape changes, drop it and rebuild from the logs.

Document current-state follows the same rule: the `documents` row is a head-of-history view that equals the nearest checkpoint advanced by all subsequent steps.

## Likely future code here
- `projection-runner`
- `entity-projection`
- `slice-projection`
- `annotation-projection`
- `boundary-projection`
- `document-projection` — nearest checkpoint plus forward replay
- `workspace-projection`

## Key relationships
- Consumes events written by repositories.
- Produces rows in the current-state tables used by everyday queries.
- Coordinates with `editor` so ProseMirror document state and the persisted step log stay in lockstep.

## Decided
- The logs and checkpoints are canonical; current-state tables are derived.
- Mutations write log and projection atomically within one SQLite transaction.
- Projections must be rebuildable from scratch.

## Open
- Whether projections run inline inside the write path or asynchronously with a guaranteed catch-up barrier.
- How to signal a projection shape migration during schema evolution.

## Deferred
- Background incremental projection maintenance beyond what correctness requires.
- Multi-projection analytics layers.
