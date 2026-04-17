# EXP-006: Pretext Layout Viability

## Status
Planned

## Date
2026-04-17

## Parent reads
- [FOR_HUMAN_AND_AI_ROADMAP--DOC.md](../../FOR_HUMAN_AND_AI_ROADMAP--DOC.md)
- [FOR_HUMAN_CODE--DOC.md](../../FOR_HUMAN_CODE--DOC.md)
- [src/renderer/editor/OPEN_QUESTIONS.md](../../src/renderer/editor/OPEN_QUESTIONS.md)

## Question
Does Pretext materially help Evernear solve long-document layout, visible-range mapping, or "where am I in the whole document?" problems before the repo commits to a final rendering design?

## Why this is load-bearing
The app may need a better answer than repeated DOM measurement if long documents, virtualized reading surfaces, or document-view navigation become expensive or awkward.

## Working hypothesis
Pretext may help with:

- deriving visible lines or line ranges
- estimating long-document height without full DOM layout
- mapping scroll state to line ranges for document view
- reducing dependence on browser reflow for long-document positioning

Pretext is not the entity matcher and should not be treated as a semantic matching engine.

## Layout sketch
```ts
function prepareDocumentLayout(text: string, font: string) {
  return pretext.prepareWithSegments(text, font, { whiteSpace: "pre-wrap" });
}

function deriveVisibleLines(prepared: PreparedTextWithSegments, viewport: Viewport, lineHeight: number) {
  const visible: LayoutLineRange[] = [];
  let y = 0;

  pretext.walkLineRanges(prepared, viewport.width, (line) => {
    const nextY = y + lineHeight;
    if (nextY >= viewport.top && y <= viewport.bottom) {
      visible.push(line);
    }
    y = nextY;
  });

  return visible;
}
```

## Spike plan
- Run Pretext against a long story document with realistic paragraph shapes.
- Test whether it can cheaply answer:
  - total line count or height at a given width
  - visible line ranges for a viewport
  - coarse position mapping for document view and long-scroll navigation
- Compare it against a simpler DOM-first approach for the same questions.
- Keep the scope exploratory:
  - document view
  - virtualized reading surface
  - long-document position awareness

## Acceptance criteria
- It becomes clear whether Pretext removes enough DOM measurement pain to matter.
- It becomes clear whether Pretext can help without forcing a full custom writing-surface rewrite.
- The experiment ends with a crisp answer:
  - adopt for document view only
  - keep as a future option
  - reject for now

## Notes for later pass
- A positive result does not automatically mean replacing the primary editor host.
- The key question is whether it improves layout and visible-range bookkeeping enough to change the long-document design.
