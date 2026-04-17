# Pane Features

## Status
MVP now

## If you landed here first
Read [src/renderer/README.md](../../README.md) and [FOR_HUMAN_BUSINESS--DOC.md](../../../../FOR_HUMAN_BUSINESS--DOC.md). Panes matter because persistent side context is part of the core promise, not just layout chrome.

## Parent reads
- [src/renderer/features/README.md](../README.md)
- [src/renderer/README.md](../../README.md)
- [FOR_HUMAN_CODE--DOC.md](../../../../FOR_HUMAN_CODE--DOC.md)

## Owns
- Side-pane orchestration.
- Pinned context behavior.
- Renderer-side layout state and pane interactions.

## Does not own
- OS-level multi-window behavior.
- Canonical storage implementation.
- Editor matching logic.

## Inputs and outputs
- Inputs: open-target intents, pane state, persisted layout data.
- Outputs: pane open, close, and pin actions, plus layout updates.

## Key relationships
- Receives intents from `entities`, `documents`, and later `annotations`.
- Persists layout through contracts backed by `db`.
- Should stay simpler than a full IDE docking framework until the core flow is proven.

## Likely future code here
- `pane-manager`
- `pinned-context-pane`
- `layout-persistence`

## Decided
- A side pane is part of the truthful MVP.

## Open
- How much layout flexibility the first version really needs.

## Deferred
- Detachable panes and multi-monitor choreography.
