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
- Project tree, document folders, open state, and document-focused UI workflows.
- Lightweight organization such as folder assignment, ordering, and move or reorder intents.
- Document metadata presentation such as title; kinds stay generic at first.
- Renderer-side handling of active document context.
- Generic-document creation and open flows that selection-driven Everlink can reuse when the writer chooses `create new doc`.

## Does not own
- Editor internals.
- Canonical storage schema.
- Entity matching rules or slice-boundary definitions.

## Inputs and outputs
- Inputs: project folder and document metadata, active document content, ordering info, later anchored outline metadata.
- Outputs: open-document intents, active-document state, create/move/reorder intents for folders and documents, later outline-navigation intents.

## Key relationships
- Works closely with `editor` for content editing.
- Works with `projects` to present a usable project tree instead of a flat document bucket.
- Supplies document context to `entities`, `annotations`, and `panes`.
- Reopens newly created target documents directly into the pending Everlink panel flow when needed.
- Provides the content over which slices and slice boundaries are resolved.
- Should preserve ordinary select, copy, and paste expectations even when semantic overlays are visible.
- Depends on repositories and contracts for persistence, not raw storage code.

## Likely future code here
- `project-tree`
- `document-folder-tree`
- `document-list`
- `document-tabs` or `document-switcher`
- `active-document-context`
- `outline-node-navigator`

## Decided
- Documents remain a first-class concept even though the product is more than a document editor.
- The first organization model is folders plus generic documents.

## Open
- How much outline-node navigation should live here versus in `editor` or `panes` once anchored navigation lands.

## Deferred
- Binder-like manuscript tooling beyond the lightweight tree and later anchored outline nodes.
