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
- Writer-facing history surfaces: restore, named checkpoints, unified timeline.
- Presentation of document step history and domain events as one chronological story.
- Renderer-side interaction for scrubbing a document and its slice boundaries and annotations back in time.

## Does not own
- Event and step persistence — that is a `db` concern.
- Projection rebuild mechanics.
- ProseMirror `Step` and `Mapping` primitives directly — those live under `editor`.

## Inputs and outputs
- Inputs: timeline queries over the event and step logs, current projection state, checkpoint metadata.
- Outputs: restore intents, named-checkpoint create or rename intents, time-travel view requests.

## Key relationships
- Reads history through repositories exposed by contracts in `shared/contracts`.
- Coordinates with `editor` to render a historical document view with boundaries and annotations mapped to that version.
- Coordinates with `panes` so the timeline can sit alongside live work without hijacking the main surface.

## Likely future code here
- `timeline`
- `restore-controller`
- `checkpoint-manager`
- `time-travel-viewer`

## Decided
- History storage is foundational.
- The first writer-visible surface can be a minimal restore-previous-version action immediately after the truthful MVP.
- Branches and merge are not part of this feature area.

## Open
- Whether the first UI is a single restore-previous-version action or a light timeline.
- How named checkpoints are surfaced to the writer.

## Deferred
- Branching UX.
- Diff-style comparisons between arbitrary versions.
- Any merge or reconciliation workflow.
