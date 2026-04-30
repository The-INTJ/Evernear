# `src/renderer/features/documents/nav/`

## Status

Active. Owns the side-nav tree UI: nested folders, drag-and-drop reorder/reparent, inline rename, and the right-click context menu.

## If you landed here first

Read these in order:

1. [../NavPanel.tsx](../NavPanel.tsx) — the composition shell that mounts `<NavTree/>` plus the project header and footer buttons. The shell is intentionally thin — all tree behavior is here.
2. [NavTree.tsx](NavTree.tsx) — composition root for the tree. Owns context-menu state, rename-draft state, and the `DndContext` from `@dnd-kit/core`.
3. [useNavTreeStructure.ts](useNavTreeStructure.ts) — pure helper that pivots the flat `WorkspaceState` lists into `Map<parentId|null, folders[]>` and a descendant-set index used for cycle detection.
4. [useNavTreeDnd.ts](useNavTreeDnd.ts) — DnD glue. Encodes drag/drop ids, resolves drop zone (`above`/`onto`/`below`) into `moveFolder` / `moveDocument` IPC calls, and runs the auto-expand-on-hover timer.

## Parent reads

- [../README.md](../README.md) — the documents feature folder.
- [../../../state/useDocumentActions.ts](../../../state/useDocumentActions.ts) — the action hook that fronts the IPC bridge methods used here.
- [../../../../shared/domain/workspace.ts](../../../../shared/domain/workspace.ts) — `DocumentFolderRecord`, `DocumentSummary`, `MoveFolderInput`, `MoveDocumentInput`.

## Owns

- Recursive folder tree rendering with depth-based indent.
- Drag-and-drop with three drop zones per folder row (above / onto / below) and two per document row (above / below).
- Inline rename for both folders and documents (shared `<NavInlineRename/>`).
- Right-click context menu with target-aware action lists (root, unfiled, folder, document).
- Auto-expand of a collapsed folder after ~500 ms of drag-hover.

## Does not own

- Persistence. All mutations go out through `useDocumentActions`'s callbacks → `window.evernear.*` IPC → main → `WorkspaceRepository`.
- Cycle prevention as a data invariant — the renderer pre-disables impossible drops for UX, but `FolderRepository.moveFolder` is the authority and rejects with an error if the renderer ever sends an invalid move.
- Project-level UI (project switcher, "+ Folder" / "+ Document" footer buttons stay in `NavPanel.tsx`).

## Key relationships

- `<NavTree/>` consumes `WorkspaceState` and the action callbacks; emits IPC mutations through them.
- `<NavTreeFolder/>` recurses into itself for sub-folders and renders `<NavTreeDocument/>` for child docs. Both row types are draggable + droppable; each registers multiple sub-droppables that share an absolutely-positioned overlay so dnd-kit's `pointerWithin` collision detection picks the right zone.
- The `dropzone:<zone>:<kind>:<id>` and `drag:<kind>:<id>` ids in `useNavTreeDnd.ts` are the contract between the components and the hook.

## Decided

- DnD library is `@dnd-kit/core` + `@dnd-kit/sortable`. Native HTML5 was rejected for poor keyboard accessibility and clunky drop indicators inside scrollable nested lists.
- Folder delete reparents children (sub-folders and documents) to the deleted folder's parent — symmetric with the existing single-level "un-file" behavior. Server-side in `FolderRepository.deleteFolder`.
- Sibling ordering is sparse INTEGER (1024 step) with lazy per-sibling-group recompaction when the gap between neighbors shrinks to 1. See `FolderRepository.computeMoveOrdering` and the parallel implementation in `DocumentRepository`.
- "Rename" does not require a new IPC. Folder rename routes through `updateFolder`; document rename routes through `updateDocumentMeta`. Both already emit the right events.

## Open

- Drag preview component is plain CSS (`.rowDragging` reduces opacity). A richer overlay using `@dnd-kit/core`'s `<DragOverlay/>` would render above all rows and follow the pointer; deferred until users find the current preview confusing.
- Keyboard-driven drag (via `KeyboardSensor`) works at the dnd-kit level but the visual indication of which drop slot is currently focused is minimal — mostly relies on screen reader announcements. Audit before MVP if accessibility becomes a hard requirement.

## Deferred

- Multi-select drag (move multiple documents at once). Single-item drag covers the common case and avoids the reorder + selection state interaction.
- Custom indent guides (vertical lines connecting parent and child rows). Aesthetic; depth indent alone reads cleanly today.
