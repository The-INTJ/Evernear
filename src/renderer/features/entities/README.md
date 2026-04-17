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
- Showing entity matches inside story text.
- Hover previews and click-to-open target behavior.
- Renderer-side filtering or presentation of entity state.

## Does not own
- Canonical entity storage.
- Full editor host behavior.
- Slice anchoring persistence.

## Inputs and outputs
- Inputs: entities, alias rules, match results, target metadata, category styles.
- Outputs: create/edit entity intents, hover preview requests, open-target intents, local presentation state.

## Key relationships
- Depends on `shared/domain` for the canonical model.
- Works with `editor` to render in-text affordances.
- Works with `panes` to open persistent context.
- Relies on `db` through contracts and repositories for truth.

## Likely future code here
- `entity-list`
- `entity-editor`
- `match-preview`
- `target-open-controller`

## Decided
- Entities are a first-class feature area, not a helper for hyperlinks.
- Hover and click behavior belong in the honest core workflow.

## Open
- How match confidence or ambiguity should be presented when alias rules overlap.
- How much category styling should ship with the first entity workflow.

## Deferred
- Advanced matching logic beyond the rules needed to prove the concept.
