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
Writers need more than session-scoped undo. They need time travel across prose, entities, matching rules, slices, slice boundaries, and annotations, plus the reassurance that text cannot silently vanish. Source-control abstractions like diff, merge, and rebase are the wrong mental model for this audience. CRDTs are overkill for a single-user local-first product. Temporal-column schemas bloat badly for long prose.

ADR-003 chose document snapshot writes as the canonical current-state for a document and deferred persisted edit history. That deferral now costs more than it saves: slice-boundary history, annotation history, and prose history all want the same machinery, and the product promise of author ownership weakens if a project's past cannot travel with it.

## Decision
Add an event-sourced history layer that coexists with ADR-003's snapshot model. Current-state tables remain the fast path for everyday queries. They are projections of append-only history.

History is stored in two append-only streams inside the project SQLite database:

1. **Domain event log** - every semantic mutation to `Entity`, `MatchingRule`, `Slice`, `SliceBoundary`, `EntitySlice`, `Annotation`, and project-level objects emits a typed event.
2. **Document step log** - every ProseMirror transaction produces `Step` records that are persisted with their inverses, keyed to a document and a version.

ADR-003 snapshot writes continue to define current document state. In this history model:

- the `documents` row is the head current-state projection for a document
- `document_checkpoints` stores historical replay bases
- opening a historical document version loads the nearest checkpoint and replays forward steps

MVP writes commit as append-then-project inside one SQLite transaction. Async projection maintenance is explicitly deferred.

Slice boundary and annotation history rides on the same `Mapping` substrate as live anchor migration. Every semantic anchor mutation records the anchor payload together with `documentVersionSeen`. To reconstruct an anchor at version `V`, start from the latest anchor event at or before `V`, then map it forward through subsequent document steps. If mapping collapses or deletes the range, the anchor becomes invalid rather than being silently healed.

A unified timeline remains the long-term product shape, but the first writer-visible surface can be a minimal restore-previous-version action.

## Consequences
- ADR-003's `Deferred: Persisted edit history` line is lifted by this ADR. Its snapshot model for current-state remains in force and is repurposed as the checkpoint primitive.
- Every mutation path must append to the appropriate log before updating projections, inside a single SQLite transaction.
- Current-state tables stop being the source of truth. Projections are rebuildable from the logs and checkpoints.
- Portability must package logs and checkpoints, not just the current projection, or history is lost on export.
- The schema gains `events`, `document_steps`, and `document_checkpoints` table families.
- The repository layer gains append-only history writers plus read paths for checkpoint load, document replay, and projection rebuild.
- Merge, conflict resolution, CRDTs, and collaboration remain permanently out of scope.

## Decided
- History is event-sourced.
- ProseMirror `Step` is the document-content history primitive.
- Boundary and annotation time travel ride on ProseMirror `Mapping`.
- ADR-003 snapshot writes are reused as checkpoints.
- The `documents` row remains current state; `document_checkpoints` stores historical replay bases.
- MVP history writes append then project inline inside one SQLite transaction.
- The first writer-visible history surface can be a minimal restore-previous-version action.
- Merge, conflict resolution, branching as a product feature, and collaboration stay out of scope.

## Open
- Checkpoint cadence beyond every explicit save, and whether writers can name a checkpoint directly.
- Event payload versioning conventions as event shapes evolve.
- Exact UI behavior when an invalidated `SliceBoundary` or `Annotation` needs repair.

## Deferred
- A scrubbable unified timeline UI beyond the initial restore-first surface.
- Named branches as a product feature.
- Async projection maintenance or catch-up barriers.
- Cross-project history sync.
