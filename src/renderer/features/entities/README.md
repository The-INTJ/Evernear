# Entity Features

## Status
MVP now

## If you landed here first
Read [src/renderer/features/README.md](../README.md), then [src/shared/domain/README.md](../../../shared/domain/README.md), then [FOR_HUMAN_BUSINESS--DOC.md](../../../../FOR_HUMAN_BUSINESS--DOC.md). This area is the heart of the product idea.

## Parent reads
- [src/renderer/features/README.md](../README.md)
- [src/renderer/README.md](../../README.md)
- [src/shared/domain/README.md](../../../shared/domain/README.md)
- [FOR_HUMAN_CODE--DOC.md](../../../../FOR_HUMAN_CODE--DOC.md)

## Owns
- Entity creation and editing UI.
- Editing the list of things an entity should match in text.
- Editing the slice library an entity should surface when one of those matches is activated.
- Selection-driven `Everlink it!` entry, chooser flow, and explicit attach-to-existing-entity behavior.
- Showing derived highlights inside story text.
- Hover modal requests and click-to-open panel behavior.
- Renderer-side management of how entities expose their associated slices.

## Does not own
- Canonical entity storage.
- Full editor host behavior.
- Slice-boundary persistence or document-view editing.

## Inputs and outputs
- Inputs: entities, matching rules, slice associations, visible-range derived match results, local interaction state, highlight mode, current selection context.
- Outputs: create/edit entity intents, Everlink chooser intents, modal requests, panel-open intents, local presentation state.

## Key relationships
- Depends on `shared/domain` for the canonical model.
- Works with `editor` to render in-text affordances.
- Works with `panes` to host the persistent panel and slice viewer.
- Relies on `db` through contracts and repositories for truth.

## Likely future code here
- `entity-explorer`
- `entity-editor`
- `slice-association-editor`
- `everlink-chooser`
- `highlight-controller`

## Decided
- Entities are a first-class feature area, not a helper for hyperlinks.
- Entity matches are derived live from current text, not precomputed and stored.
- Selection-driven Everlink may bootstrap or extend an entity, but it must not auto-reuse merely similar entities without explicit author choice.
- Hover modal and persistent panel behavior belong in the honest core workflow.
- Live matching should be disable-able so writing mode can stay visually quiet.

## Open
- How match confidence or ambiguity should be presented when matching rules overlap.
- Whether the first workflow should start with whole-document slices before boundary editing lands.
- Whether highlighting-off while writing should fully skip matching work or just suppress rendering.

## Deferred
- Advanced matching logic beyond the rules needed to prove the concept.
