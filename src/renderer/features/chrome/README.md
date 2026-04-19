# Renderer Chrome

## Status
MVP now

## If you landed here first
Read [src/renderer/features/README.md](../README.md), then [src/main/README.md](../../../main/README.md). The chrome surface bridges Electron window policy and the renderer's React tree.

## Parent reads
- [src/renderer/features/README.md](../README.md)
- [src/renderer/README.md](../../README.md)
- [FOR_HUMAN_CODE--DOC.md](../../../../FOR_HUMAN_CODE--DOC.md)

## Owns
- The custom title bar that replaces the OS frame.
- The drag region (`-webkit-app-region: drag`) and which controls opt out.
- Workspace-level chrome controls: project switcher, "New Project", panel toggle.

## Does not own
- The OS-rendered min/max/close buttons (Electron's `titleBarOverlay` paints those).
- Per-pane chrome (e.g. PanelDocumentView's "Edit slices" / "Close" strip).
- Project mutations themselves — those live in `useWorkspaceActions`.

## Key relationships
- Reads from `WorkspaceState` (`projects`, `layout.activeProjectId`, `layout.panelOpen`).
- Calls back into `useWorkspaceActions` for `switchProject`, `createProject`, `togglePanel`.
- Coordinates with `src/main/index.ts` BrowserWindow options (`frame: false`, `titleBarStyle: "hidden"`, `titleBarOverlay`).

## Decided
- Chrome lives in renderer, not main. Main only declares window-policy primitives.
- The title bar is a single thin row; we do not stack a separate menu band on top.

## Open
- Whether per-document tabs eventually live here or in their own row.

## Deferred
- Custom min/max/close buttons (we lean on `titleBarOverlay` for now).
- macOS/Linux variants — current overlay tuning is Windows-first.
