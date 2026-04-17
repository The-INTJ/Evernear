# Annotation Features

## Status
Soon

## If you landed here first
Read [FOR_HUMAN_BUSINESS--DOC.md](../../../../FOR_HUMAN_BUSINESS--DOC.md) first. This feature matters, but it follows the entity-and-context workflow rather than leading it.

## Parent reads
- [src/renderer/features/README.md](../README.md)
- [src/renderer/README.md](../../README.md)
- [FOR_HUMAN_CODE--DOC.md](../../../../FOR_HUMAN_CODE--DOC.md)

## Owns
- Low-noise personal notes tied to reading or writing context.
- Minimal annotation UI that does not behave like collaborative review software.

## Does not own
- The main writing loop.
- Comment-heavy collaboration workflows.
- Slice or entity truth.

## Inputs and outputs
- Inputs: selection anchors, document context, annotation records.
- Outputs: create, edit, and delete note intents plus subtle display state.

## Key relationships
- Anchors to documents and possibly slices.
- Should coexist quietly with entity overlays and pane workflows.

## Likely future code here
- `annotation-glyphs`
- `annotation-editor`
- `annotation-list` if needed

## Decided
- Annotation is important, but not at the cost of muddying the core re-entry loop.

## Open
- What the quietest useful annotation affordance looks like.

## Deferred
- Collaboration, notifications, or review-style threading.
