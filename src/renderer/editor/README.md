# Editor

## Status
MVP now

## If you landed here first
Read [src/renderer/README.md](../README.md) first. Then read [src/shared/domain/README.md](../../shared/domain/README.md) so the editor behavior stays grounded in domain language rather than ad hoc UI terms.

## Parent reads
- [src/renderer/README.md](../README.md)
- [FOR_HUMAN_CODE--DOC.md](../../../FOR_HUMAN_CODE--DOC.md)
- [src/shared/domain/README.md](../../shared/domain/README.md)

## Owns
- The editor host setup.
- Rendering and interaction hooks for derived highlights.
- Selection affordances that can start or edit an `Everlink it!` flow from current text.
- Selection, hover, click, and document-view boundary affordances inside the writing surface.
- Temporary pending-slice rails and local range growth behavior inside panel document view.
- The editor-local mapping and decoration path for shared anchors.

## Does not own
- Canonical entity data.
- Database access.
- Project lifecycle logic.

## Inputs and outputs
- Inputs: document content, derived highlight results, active slice boundaries, active interaction state, pending Everlink session state.
- Outputs: edit events, hover and click events, selection anchors, Everlink intents, boundary-edit gestures, display-ready decorations.

## Key relationships
- Receives domain results from feature or shared layers.
- Feeds interaction intents back into panel and feature workflows.
- Must stay separable from persistence and OS concerns.

## Likely future code here
- `prosemirror-host`
- `decorations`
- `transaction-bridge`
- `interaction-handlers`
- `selection-everlink`
- `selection-anchor` helpers
- `boundary-handle` helpers for document view

## Decided
- ProseMirror is the editor foundation.
- Semantic behavior should layer onto the editor rather than redefine the whole app around editor internals.
- Derived highlights and quiet annotation underlines should ride on editor decorations, not stored document marks.
- Selection-driven Everlink authoring should begin from editor affordances, but the manuscript itself should remain free of stored link markup.
- `Step` and `Mapping` are the editor-side primitives that feed document history and anchor migration.

## Open
- The minimum prose-first schema needed before formatting ambitions start to sprawl.
- How far widget or node-view work should go before the core workflow is proven.

## Deferred
- Rich formatting ambitions that do not directly serve writing and re-entry.
