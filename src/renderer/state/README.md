# Renderer State

## Status
MVP now

## If you landed here first
Read [src/renderer/README.md](../README.md) first. The hooks here are the renderer's seam between the IPC bridge and feature components — App.tsx composes them and threads their results into `src/renderer/features/`.

## Parent reads
- [src/renderer/README.md](../README.md)
- [FOR_HUMAN_CODE--DOC.md](../../../FOR_HUMAN_CODE--DOC.md)
- [src/shared/domain/README.md](../../shared/domain/README.md)

## Owns
- Workspace lifecycle and persistence orchestration ([useWorkspace.ts](useWorkspace.ts)).
- Per-aggregate mutation dispatch tables: project, document, entity, slice/layout actions, composed by [useWorkspaceActions.ts](useWorkspaceActions.ts).
- Selection-driven Everlink flow split across [useEverlinkSession.ts](useEverlinkSession.ts) (entity / target document choice) and [usePendingPlacement.ts](usePendingPlacement.ts) (in-editor placement + commit).
- Memoised id-indexed projections of the workspace ([useWorkspaceLookups.ts](useWorkspaceLookups.ts)).
- Editor-surface selection state ([useEditorSelections.ts](useEditorSelections.ts)).
- Short-lived UI session shapes that are not persisted ([sessionTypes.ts](sessionTypes.ts)).

## Does not own
- Persistence (lives behind the IPC bridge in `src/main/` and `src/db/`).
- Editor view internals (lives in `src/renderer/editor/`).
- Feature-specific layout (lives in `src/renderer/features/`).
- React component rendering — these are hooks and types only.

## Key relationships
- `useWorkspace` is the source of truth for the loaded `WorkspaceState`; the action hooks call its `runMutation` to fan out IPC calls and apply the returned snapshot.
- The Everlink split is deliberate: session orchestration (entity creation, rule upsert, target document creation) ↔ placement orchestration (pending range, anchor build, slice creation). FB-002 Everslice will land as a third sibling, not a merge.
- Mutation hooks never reach into the editor refs — placement does, because it owns the in-editor pending range.

## Decided
- Hooks are split per concern, not per file size. The 250-line hard cap from CLAUDE.md is enforced — `useEverlinkPlacement` and `useWorkspaceActions` were both split when they crossed it.
- The action-hook split is by aggregate (project / document / entity / slice+layout). Adding a new mutation goes into the matching per-aggregate hook, not the composition facade.
- `commitInFlightRef` and `placementRef` are refs (not state) because the commit window must read the latest values synchronously after `await flushPersistence()` — see the comment block in [usePendingPlacement.ts](usePendingPlacement.ts) for the race-window history.

## Open
- Whether the action hooks should adopt a typed reducer pattern as the surface grows. Today the dispatch-table style is fine; revisit when one of them passes the 150-line soft cap.

## Deferred
- A renderer-side projection cache layer (refineCode C6) — wait until profiling shows the lookups are the bottleneck.
