# Help Feature

## Status
MVP now

## If you landed here first
Read [src/renderer/features/README.md](../README.md) and [src/renderer/README.md](../../README.md). This folder owns user-facing guidance that is displayed inside the app.

## Parent reads
- [src/renderer/features/README.md](../README.md)
- [src/renderer/README.md](../../README.md)
- [FOR_HUMAN_BUSINESS--DOC.md](../../../../FOR_HUMAN_BUSINESS--DOC.md)

## Owns
- In-app help and shortcut guidance.
- Workspace-level instructional pages opened from the custom chrome.

## Does not own
- Product documentation outside the app.
- Editor command implementations.
- Navigation or persistence state beyond entering and leaving help views.

## Key relationships
- Opens from `features/chrome`.
- Explains workflows hosted by `features/documents`, `features/entities`, and `features/panes`.

## Decided
- Help is an in-app page so authors can read it without leaving the desktop workspace.

## Open
- Whether later help pages should become searchable.

## Deferred
- Deep contextual help tied to individual panes.
