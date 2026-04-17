# Annotation Features

## Status
MVP now

## If you landed here first
Read [FOR_HUMAN_BUSINESS--DOC.md](../../../../FOR_HUMAN_BUSINESS--DOC.md) first. Annotations are designed now because they ride on the same anchor substrate as slice boundaries, even if their full UI lands after the central loop.

## Parent reads
- [src/renderer/features/README.md](../README.md)
- [src/renderer/README.md](../../README.md)
- [FOR_HUMAN_CODE--DOC.md](../../../../FOR_HUMAN_CODE--DOC.md)
- [docs/experiments/EXP-001-shared-anchor-substrate.md](../../../../docs/experiments/EXP-001-shared-anchor-substrate.md)

## Owns
- Low-noise personal notes tied to reading or writing context.
- Minimal annotation UI that does not behave like collaborative review software.
- The quiet visual treatment for direct document anchors that are not entity matches.

## Does not own
- The main entity-matching loop.
- Comment-heavy collaboration workflows.
- Slice or entity truth.

## Inputs and outputs
- Inputs: shared text anchors, document context, annotation records, annotation style preferences.
- Outputs: create, edit, and delete note intents plus subtle display state.

## Key relationships
- Uses the same underlying anchor-healing model as slice boundaries.
- Conceptually behaves like a direct document anchor with no matching-rule lookup.
- Should coexist quietly with derived highlights and panel workflows.

## Likely future code here
- `annotation-underlines`
- `annotation-editor`
- `annotation-style-settings`
- `annotation-list` if needed

## Decided
- Annotation is part of the initial design pass, not a vague later add-on.
- The default annotation affordance should be quieter than entity highlights, such as a dotted gray underline.
- The author should be able to tune that visual style later without changing the underlying anchor model.

## Open
- Whether the first version needs click-only notes, selection-based notes, or both on day one.

## Deferred
- Collaboration, notifications, or review-style threading.
