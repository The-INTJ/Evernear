# Renderer Utilities

## Status
MVP now

## If you landed here first
Read [src/renderer/README.md](../README.md) first. The modules here are pure helpers — no React state, no IPC, no DOM. If you find yourself needing one of those, the file does not belong in this folder.

## Parent reads
- [src/renderer/README.md](../README.md)
- [FOR_HUMAN_CODE--DOC.md](../../../FOR_HUMAN_CODE--DOC.md)

## Owns
- Small text and number formatters used across feature components ([formatting.ts](formatting.ts)).
- Pure read helpers over `WorkspaceState` that derive lookups without React state ([workspace.ts](workspace.ts)).
- Renderer-side feature flags driven by `import.meta.env` ([devFlags.ts](devFlags.ts)).
- Dev-only in-memory mock of `window.evernear` for plain-browser previews of the renderer ([devBrowserBridge.ts](devBrowserBridge.ts)).

## Does not own
- React hooks (those live in [src/renderer/state/](../state/README.md)).
- IPC contracts (those live in [src/shared/contracts/](../../shared/contracts/README.md)).
- Domain types (those live in [src/shared/domain/](../../shared/domain/README.md)).
- Editor view code (those live in [src/renderer/editor/](../editor/README.md)).

## Key relationships
- Feature components import the formatters and workspace lookups directly; they never reach for React state from this folder.
- The dev browser bridge is conditionally installed by `main.tsx` only when `contextBridge` has not exposed `window.evernear` (i.e. running outside Electron). The Electron build never touches it.
- `DEBUG_PANELS` from devFlags gates the optional run log, engine metrics, and editor legend panels — used in feature components to keep the production shell clean.

## Decided
- Pure functions only. Anything that holds state, talks to IPC, or touches the DOM goes elsewhere.
- The dev browser bridge is the one allowed `as unknown as HarnessBridge` cast in the renderer; everything else uses the typed bridge from preload.

## Open
- Whether `formatting.ts` should split into per-domain formatters (e.g. `documentFormatting`, `entityFormatting`) once it crosses ~150 lines.

## Deferred
- A renderer-side i18n layer. Today every formatter assumes `en-US`.
