# Main Process

## Status
MVP now

## If you landed here first
Read [src/README.md](../README.md) for the overall source layout, then [FOR_HUMAN_CODE--DOC.md](../../FOR_HUMAN_CODE--DOC.md) for the runtime boundary rationale.

## Parent reads
- [src/README.md](../README.md)
- [FOR_HUMAN_CODE--DOC.md](../../FOR_HUMAN_CODE--DOC.md)
- [ADR-001](../../docs/adr/ADR-001-stack-and-shell-baseline.md)

## Owns
- Electron app bootstrap and lifecycle.
- Opening and closing local projects from the operating system boundary.
- Window creation policy and startup behavior.
- IPC registration and wiring to persistence/services.

## Does not own
- React component state.
- Editor rendering behavior.
- Raw domain definitions.

## Inputs and outputs
- Inputs: filesystem paths, app events, window intents, typed IPC handlers.
- Outputs: initialized windows, project-open sessions, database bootstrap, IPC availability.

## Key relationships
- Talks to `src/db` to open project storage.
- Exposes only approved capabilities through `src/preload`.
- Hosts the renderer but should not quietly absorb renderer logic.

## Likely future code here
- `app-bootstrap`
- `window-factory`
- `project-open-service`
- `ipc-registration`

## Decided
- Main owns privileged OS and lifecycle concerns.
- Main should be thin but authoritative at the app boundary.

## Open
- Whether project-open orchestration lives directly here or in a service subfolder.

## Deferred
- Advanced multi-window and detached-window policies beyond the first truthful workflow.
