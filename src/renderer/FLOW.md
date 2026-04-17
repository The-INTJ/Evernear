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
2. Show a document list or current draft alongside any pinned panels.
3. Render derived highlights from entity matches in the editor without overwhelming the page.
4. Hover a highlight to open a modal with the slice viewer.
5. Click a highlight to open a persistent panel, then optionally a deeper document view for a slice.
6. Let the writer keep working without losing their place.
7. Persist relevant panel layout and interaction state locally.

## Decided
- Hover, click, modal behavior, and panel persistence are renderer concerns even when data comes from deeper layers.

## Open
- How much of this flow should be explicit shell state versus feature-owned state.

## Deferred
- Advanced workflow visualizations and secondary dashboards.
