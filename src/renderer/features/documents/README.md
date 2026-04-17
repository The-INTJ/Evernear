# Document Features

## Status
MVP now

## If you landed here first
Read [src/renderer/features/README.md](../README.md), then [src/shared/domain/README.md](../../../shared/domain/README.md). Documents are where writing happens, but their meaning comes from the shared model.

## Parent reads
- [src/renderer/features/README.md](../README.md)
- [src/renderer/README.md](../../README.md)
- [src/shared/domain/README.md](../../../shared/domain/README.md)

## Owns
- Document list, open state, and document-focused UI workflows.
- Document metadata presentation such as title and kind.
- Renderer-side handling of active document context.

## Does not own
- Lexical editor internals.
- Canonical storage schema.
- Entity matching rules.

## Inputs and outputs
- Inputs: project document metadata, active document content, ordering info.
- Outputs: open-document intents, active-document state, rename/reorder intents.

## Key relationships
- Works closely with `editor` for content editing.
- Supplies document context to `entities`, `annotations`, and `panes`.
- Depends on repositories and contracts for persistence, not raw storage code.

## Likely future code here
- `document-list`
- `document-tabs` or `document-switcher`
- `active-document-context`

## Decided
- Documents remain a first-class concept even though the product is more than a document editor.

## Open
- Whether story, lore, and reference documents should diverge in UI behavior early or stay uniform at first.

## Deferred
- Rich outline and manuscript-management tooling.
