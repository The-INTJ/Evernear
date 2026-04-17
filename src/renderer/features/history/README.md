# History Features

## Status
Soon

## If you landed here first
Read [src/renderer/features/README.md](../README.md) first, then [ADR-006](../../../../docs/adr/ADR-006-event-sourced-document-and-metadata-history.md). History storage is foundational, but the writer-facing surface lands right after the truthful MVP proves itself.

## Parent reads
- [src/renderer/features/README.md](../README.md)
- [src/renderer/README.md](../../README.md)
- [FOR_HUMAN_CODE--DOC.md](../../../../FOR_HUMAN_CODE--DOC.md)
- [ADR-006](../../../../docs/adr/ADR-006-event-sourced-document-and-metadata-history.md)

## Owns
- Writer-facing history surfaces: restore, named checkpoints, and later the unified timeline.
- Presentation of document step history and domain events as one chronological story once timeline work lands.
- Renderer-side interaction for viewing a document and its slice boundaries and annotations at historical versions.

## Does not own
- Event and step persistence - that is a `db` concern.
- Projection rebuild mechanics.
- ProseMirror `Step` and `Mapping` primitives directly - those live under `editor`.

## Inputs and outputs
- Inputs: restore queries over the event and step logs, current projection state, and checkpoint metadata.
- Outputs: restore intents, named-checkpoint create or rename intents, and time-travel view requests.

## Key relationships
- Reads history through repositories exposed by contracts in `shared/contracts`.
- Coordinates with `editor` to render a historical document view with boundaries and annotations mapped to that version.
- Coordinates with `panes` so later timeline surfaces can sit alongside live work without hijacking the main surface.

## Likely future code here
- `restore-controller`
- `checkpoint-manager`
- `time-travel-viewer`
- `timeline`

## Decided
- History storage is foundational.
- The first writer-visible surface is a minimal restore-previous-version action immediately after the truthful MVP.
- Branches and merge are not part of this feature area.

## Open
- How named checkpoints are surfaced to the writer.
- When the unified timeline becomes worth shipping beyond restore-first behavior.

## Deferred
- Branching UX.
- Diff-style comparisons between arbitrary versions.
- Any merge or reconciliation workflow.
