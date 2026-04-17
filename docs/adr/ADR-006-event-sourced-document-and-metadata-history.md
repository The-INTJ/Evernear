# ADR-006: Event-Sourced Document and Metadata History

## Status
Accepted

## Date
2026-04-17

## Parent reads
- [FOR_HUMAN_CODE--DOC.md](../../FOR_HUMAN_CODE--DOC.md)
- [FOR_HUMAN_BUSINESS--DOC.md](../../FOR_HUMAN_BUSINESS--DOC.md)
- [ADR-002](./ADR-002-sqlite-first-with-portability.md)
- [ADR-003](./ADR-003-document-persistence-and-editor-state.md)
- [ADR-005](./ADR-005-editor-foundation-locked-to-prosemirror.md)

## Context
Writers need more than session-scoped undo. They need time travel across prose, entities, matching rules, slices, slice boundaries, and annotations, plus the reassurance that text cannot silently vanish. Source-control abstractions — diff, merge, rebase — are the wrong mental model for this audience. CRDTs are overkill for a single-user local-first product. Temporal-column schemas bloat badly for long prose.

ADR-003 chose document snapshot writes as the canonical current-state for a document and deferred persisted edit history. That deferral now costs more than it saves: slice-boundary history, annotation history, and prose history all want the same machinery, and the product promise of author ownership weakens if a project's past cannot travel with it.

## Decision
Add an event-sourced history layer that coexists with ADR-003's snapshot model. Current-state tables remain the fast path for everyday queries. They are projections of an append-only history.

History is stored in two append-only streams inside the project SQLite database:

1. **Domain event log** — every semantic mutation to `Entity`, `MatchingRule`, `Slice`, `SliceBoundary`, `EntitySlice`, `Annotation`, and project-level objects emits a typed event.
2. **Document step log** — every ProseMirror transaction produces `Step` records that are persisted with their inverses, keyed to a document and a version.

Document snapshots defined by ADR-003 serve as **checkpoints** in this model. The `documents` row is always the head-of-history checkpoint. Opening a historical document version loads the nearest checkpoint and replays forward steps.

Slice boundary and annotation positions migrate forward through ProseMirror's `Mapping`. The same mechanism time-travels their positions when viewing a historical document version.

A unified timeline orders both streams by wall time so the writer sees prose edits and metadata changes as one chronological story.

## Consequences
- ADR-003's `Deferred: Persisted edit history` line is lifted by this ADR. Its snapshot model for current-state remains in force and is repurposed as the checkpoint primitive.
- Every mutation path must append to the appropriate log before updating projections, inside a single SQLite transaction.
- Current-state tables stop being the source of truth. Projections are rebuildable from the logs and last checkpoint.
- Portability must package logs and checkpoints, not just the current projection, or history is lost on export.
- The schema gains `events`, `document_steps`, and `document_checkpoints` table families; the repository layer gains append-only writers and a projection-rebuild path.
- Branches are modeled in the log as alternate streams with a parent pointer and a fork point. No branch UI is in scope for MVP.
- Merge, conflict resolution, CRDTs, and collaboration remain permanently out of scope.

## Decided
- History is event-sourced.
- ProseMirror `Step` is the document-content history primitive.
- Boundary and annotation time travel ride on ProseMirror `Mapping`.
- ADR-003 snapshot writes are reused as checkpoints.
- Merge, conflict resolution, and collaboration stay permanently out of scope.

## Open
- Checkpoint cadence beyond every explicit save, and whether writers can name a checkpoint directly.
- Event payload versioning conventions as event shapes evolve.
- Whether the first writer-facing surface is a scrubbable timeline or a single restore-previous-version action.
- Exact handling when prose deletes a region that a `SliceBoundary` or `Annotation` depended on.

## Deferred
- A history UI beyond the simplest restore-previous-version surface.
- Named branches as a product feature.
- Cross-project history sync.
