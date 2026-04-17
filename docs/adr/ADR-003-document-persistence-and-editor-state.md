# ADR-003: Document Persistence and Editor State

## Status
Accepted

## Date
2026-04-17

## Parent reads
- [FOR_HUMAN_CODE--DOC.md](../../FOR_HUMAN_CODE--DOC.md)
- [FOR_HUMAN_AND_AI_ROADMAP--DOC.md](../../FOR_HUMAN_AND_AI_ROADMAP--DOC.md)
- [src/db/README.md](../../src/db/README.md)
- [src/renderer/editor/README.md](../../src/renderer/editor/README.md)

## Context
The document row is the seam between the editor host and SQLite.
If that seam stays vague, the editor choice can quietly dictate the whole architecture.

Evernear is currently single-user-first and local-first.
It needs:

- reliable document round-tripping
- a plain-text projection for matching and export helpers
- clean separation between persisted truth and transient editor UI state
- room for slice boundaries and annotations to live outside the editor's ephemeral runtime objects

Delta streams and diff-on-save both add complexity before they solve a real problem here.

## Decision
Persist each document as a full snapshot write plus a plain-text projection.

The working row shape is:

- `contentFormat`: identifies the editor schema family
- `contentSchemaVersion`: identifies the stored snapshot version
- `contentJson`: stores the canonical structured document snapshot
- `plainText`: stores the denormalized text projection used by matching, search, and export helpers

Do not persist:

- active selection
- undo or redo history
- active decorations
- transient plugin state
- renderer-only interaction state

Save using whole-snapshot writes on debounce or explicit commit, not a delta stream.

Slice boundaries and annotations must not depend on ephemeral editor node keys alone.
They persist through shared `TextAnchor` payloads that can be mapped forward during live edits and re-resolved later if mapping alone is not enough.

## Consequences
- The storage model stays understandable and debuggable.
- The editor host can be swapped only through an explicit migration, which is acceptable because `contentFormat` and `contentSchemaVersion` make that blast radius visible.
- Matching and export helpers can work from `plainText` without having to parse editor internals every time.
- Collaboration-oriented storage patterns are deliberately deferred.

## Decided
- The canonical persistence model for current-state is snapshot-based, not delta-based.
- Snapshot writes are reused as checkpoints by the history layer defined in [ADR-006](./ADR-006-event-sourced-document-and-metadata-history.md).

## Open
- Exact save cadence and batching policy.
- Exact SQLite column names and whether `plainText` should live in the same table or a tightly-coupled companion table.

## Deferred
- Collaboration-first document storage.

## Superseded deferrals
- Persisted edit history. Lifted by [ADR-006](./ADR-006-event-sourced-document-and-metadata-history.md), which adds an event-sourced history layer that reuses these snapshots as checkpoints.
