# Feature Brief: Everslice it — selection → add to entity

## Status
Draft

## Date
2026-04-18

## Problem
Everlink is optimized for the story-to-lore direction: pick text in the manuscript, create or extend an entity, then place the matching slice in a separate lore document. There is no symmetric flow for the opposite motion — the author is already *inside* a lore or reference document, sees a passage that is clearly *about* an entity, and wants to bind that passage as a slice in place. Today they must copy, open a chooser, set a target, and route around themselves to end up on the same page they started on. The friction pushes authors to skip lightweight annotation entirely.

## Desired outcome
From any open document, the author can highlight a passage and, via one modal, pick an entity (new or existing, searched by name or alias) and commit — the highlight becomes a `Slice` in the current document, linked to that `Entity`. No target-doc dance, no placement step.

## Non-goals
- Not a replacement for Everlink. Everlink still owns the story-to-lore placement flow and the `PendingEverlinkSession` state it uses.
- Not a bulk operation. One selection → one slice → one entity per invocation.
- No cross-doc movement. If the author wants the slice to land in a different document, Everlink is the right tool.
- No new matching-rule authoring in this modal. This flow only *links* a selection to an entity via `EntitySlice`; it does not seed regex/literal matches. (Follow-up: a "promote to matching rule" affordance can be added once the slice exists.)

## Core flow
1. Author selects a passage in any document and clicks `Everslice it!` in the editor toolbar (or a keybinding — TBD).
2. A modal opens, centered on the editor. It shows the selected text, an entity search input (filters by name and alias/pattern text in `MatchingRule`), a scrollable result list, and a `+ New entity` row at the end.
3. Author types to filter, clicks an entity row (or `+ New entity` with a name). Confirm commits the slice.
4. On confirm: one IPC call creates the `Slice` against the current document's anchor (same `buildTextAnchorFromSelection` path used by Everlink's commit), links it to the chosen `Entity` via `EntitySlice`, and appends the relevant domain events. The modal closes; the editor shows the new slice boundary decoration on the original selection.
5. If the author was creating a new entity, a second event creates the `Entity` first inside the same transaction, so the slice ↔ entity link is never orphaned.

## Data and model touchpoints
- Reuses `Entity`, `Slice`, `SliceBoundary`, `EntitySlice`, `TextAnchor`, `AnchorResolutionResult`.
- Reuses the existing `createSlice` IPC path (`HarnessBridge.createSlice`) — the only difference from Everlink is that the target document equals the source document, so no target-switching logic runs.
- New IPC is *not* required if the entity lookup/creation can happen client-side against the loaded workspace. If search needs server-side paging later, add `searchEntities` per R3.
- No new domain types. The flow is a thinner version of `PendingSlicePlacement` that skips the `surface` / `targetDocumentId` fields because they're implied.

## UI surfaces
- Editor toolbar button: `Everslice it!` — enabled when the main editor has a non-empty selection, disabled otherwise. Lives next to `Everlink it!`.
- Modal: `EversliceChooser` feature component under `src/renderer/features/entities/`. Owns its own entity search and a minimal local form state (selected entity id + optional new-entity name).
- No changes to the side panel — this flow is intentionally in-editor and modal so the author's focus stays on the passage.

## Hook and state shape (sketch)
- New hook `useEverslicePlacement` under `src/renderer/state/`, following the shape of `useEverlinkPlacement` but about half the surface area. Exposes `{ isOpen, open(), close(), confirm(entityIdOrNewName) }`. No blur handlers, no cross-surface selection tracking — the selection is captured at `open()` time into a `sourceSelection` ref and stays frozen until confirm/cancel.
- Entity filter is pure local state inside the modal component. It reads `workspace.entities` + `workspace.matchingRules` and filters by case-insensitive substring match on entity name, alias rule patterns, and existing slice titles.

## Risks
- If the modal steals focus from the editor, the frozen selection can get visually lost. Mitigation: the modal keeps the selection highlighted in the editor (reuse the existing pending-slice decoration style in `HarnessEditor`).
- Search across many entities could lag if the filter runs on every keystroke unbatched. Mitigation: cap result rows at ~50 and re-evaluate only if authors report slowness on a project with more than a few hundred entities.
- The "create new entity" path makes it easy to generate near-duplicate entities. Mitigation: if the typed name matches an existing entity's name or alias case-insensitively, hoist that entity to the top of the list and require an explicit "create anyway" click.
- R7: `useEverlinkPlacement` is already at the hook cap. The symmetry is tempting — do *not* merge the two. Keep `useEverslicePlacement` separate; shared helpers (anchor building, slice creation) live in `editor/workbenchUtils.ts` or a new `src/renderer/state/everlinkShared.ts` if extraction is needed.

## Proof
- From a document with text, selecting a phrase and clicking `Everslice it!` opens a modal pre-filled with the selection.
- Typing narrows the entity list; arrow keys and Enter pick a row; Escape cancels.
- Choosing an existing entity creates a slice on the current selection linked to that entity, and the slice appears as a boundary decoration with no further input.
- Choosing `+ New entity` with a typed name creates both the entity and the slice in one transaction; a reload shows the linkage intact.
- A full destructive re-paste of the document still recovers the slice via anchor repair (same substrate as Everlink — this is what validates that no metadata rides in the prose).
- An ambiguous or missing anchor after heavy edits surfaces the `ambiguous`/`invalid` state in the existing repair UI; no silent mislinking.

## Open questions
- Keybinding? `Ctrl+Shift+L` would mirror Everlink's implicit keyboard route, but confirm with the author.
- Should the modal also allow attaching the selection as a new matching rule for the chosen entity (not just a slice)? Probably yes as a checkbox later, but out of scope for v1.
