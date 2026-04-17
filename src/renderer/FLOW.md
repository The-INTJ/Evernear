# Renderer Flow

## Status
MVP now

## If you landed here first
Read [README.md](./README.md) for folder ownership, then [FOR_HUMAN_BUSINESS--DOC.md](../../FOR_HUMAN_BUSINESS--DOC.md) for the product loop this flow is serving.

## Parent reads
- [README.md](./README.md)
- [FOR_HUMAN_BUSINESS--DOC.md](../../FOR_HUMAN_BUSINESS--DOC.md)
- [FOR_HUMAN_CODE--DOC.md](../../FOR_HUMAN_CODE--DOC.md)

## Owns
- A narrative of the expected UI loop through the renderer.

## Does not own
- Final implementation details for each feature.

## Flow
1. Open a project and restore the last useful workspace state.
2. Show a document list or current draft alongside any pinned context panes.
3. Render entity-aware text in the editor without overwhelming the page.
4. Hover to preview context and click to open deeper context in a pane.
5. Let the writer keep working without losing their place.
6. Persist relevant layout and interaction state locally.

## Decided
- Hover, click, and pane persistence are renderer concerns even when data comes from deeper layers.

## Open
- How much of this flow should be explicit shell state versus feature-owned state.

## Deferred
- Advanced workflow visualizations and secondary dashboards.
