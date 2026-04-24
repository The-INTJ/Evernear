# Pane System Progress

Evernear is for Drew first. Prefer less friction over resource economy.
When in doubt, reload, re-render, or reopen rather than disabling functionality.

## Current Phase

- [x] Phase 1 complete: shared types, migration, repository, IPC
- [x] Phase 2 complete: pane workspace skeleton
- [x] Phase 3 partial: duplicate document panes reload unfocused views from persisted document versions
- [x] Phase 4 complete: hover click promotes entity slices into a real pane; slices can take over/open new panes
- [x] Phase 5 partial: floating panes can move/resize and docked panes render in left/right/bottom regions
- [x] Phase 6 partial: panes can pop into native Electron windows and restore on window close
- [ ] Phase 7 complete: old layout model retired from renderer

## Current Known Breakage

- `activeDocument` / `panelDocument` still exist as compatibility fields and several old workflows still lean on them.
- Cross-window document sync uses periodic reload, not a collaborative merge system.
- Dock stack previews and tab-style stacks are not polished yet.
- Native pane windows restore to a default workspace rectangle rather than their exact previous in-app position.

## Last Verification

- `npm run typecheck`
- `npm run lint`
- `npm run test` (87 tests)
- `npm run build`

## Next Concrete Task

- Retire renderer assumptions around the old side panel and route Everlink/Everslice placement through focused panes.

## Future Work Queue

- Replace periodic cross-window reload with explicit `workspaceChanged` / `documentChanged` broadcasts.
- Make focused document panes rehydrate intelligently when another window edits the same document.
- Add drag-hover dock previews and tab-style stacks.
- Add drag-to-promote hover previews, not only click-to-promote.
- Persist exact native window bounds and restore exact prior in-app pane placement.
- Remove renderer dependence on `activeDocument`, `panelDocument`, `panelOpen`, and `panelMode`.
