# Panel Features

## Status
MVP now

## If you landed here first
Read [src/renderer/README.md](../../README.md) and [FOR_HUMAN_BUSINESS--DOC.md](../../../../FOR_HUMAN_BUSINESS--DOC.md). Panels matter because persistent side context is part of the core promise, not just layout chrome.

## Parent reads
- [src/renderer/features/README.md](../README.md)
- [src/renderer/README.md](../../README.md)
- [FOR_HUMAN_CODE--DOC.md](../../../../FOR_HUMAN_CODE--DOC.md)

## Owns
- Persistent panel orchestration.
- Slice-viewer hosting and document-view transitions.
- Target-document placement and pending-slice editing for selection-driven Everlink flows.
- Renderer-side layout state and panel interactions.

## Does not own
- OS-level multi-window behavior.
- Canonical storage implementation.
- Editor matching logic.

## Inputs and outputs
- Inputs: panel-open intents, slice-viewer state, pending Everlink session state, persisted layout data.
- Outputs: panel open, close, pin, document-view navigation actions, pending-slice commit intents, plus layout updates.

## Key relationships
- Receives intents from `entities`, `documents`, and `annotations`.
- Persists layout through contracts backed by `db`.
- Should stay simpler than a full IDE docking framework until the core flow is proven.
- Hosts the persistent panel view for slices and the deeper document view when needed.
- Keeps hover preview read-only and quick while authoring and boundary mutation live in persistent panel document view.

## Likely future code here
- `panel-manager`
- `slice-viewer-panel`
- `document-view-shell`
- `layout-persistence`

## Decided
- A persistent panel is part of the truthful MVP.
- Selection-driven slice placement happens in persistent panel document view, not inside a transient hover modal.

## Open
- How much layout flexibility the first version really needs.

## Deferred
- Detachable panels and multi-monitor choreography.
