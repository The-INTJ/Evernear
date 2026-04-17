# ADR-005: Editor Foundation Locked to ProseMirror

## Status
Accepted

## Date
2026-04-17

## Parent reads
- [FOR_HUMAN_CODE--DOC.md](../../FOR_HUMAN_CODE--DOC.md)
- [ADR-001](./ADR-001-stack-and-shell-baseline.md)
- [ADR-003](./ADR-003-document-persistence-and-editor-state.md)
- [EXP-003](../experiments/EXP-003-lexical-prototype-walkthrough.md)
- [EXP-004](../experiments/EXP-004-prosemirror-prototype-walkthrough.md)

## Context
ADR-001 named ProseMirror as the current front-runner and left the choice open pending the walkthroughs captured in EXP-003 and EXP-004. Those walkthroughs showed that ProseMirror's transactions, `Mapping`, and `Decoration` model line up directly with Evernear's core problems — anchor healing, derived highlights, boundary editing, and a history layer that can be built on `Step`. Lexical would push the same work into bespoke infrastructure around the editor rather than through primitives inside it.

ADR-006 makes a history subsystem that rides on ProseMirror `Step` records a first-class concern, which makes "front-runner" language no longer honest. The editor choice has to be a floor that later decisions can stand on.

## Decision
ProseMirror is the editor foundation for Evernear. All planning and implementation passes should treat it as assumed rather than pending. Lexical is rejected. The question is closed unless a concrete ProseMirror-specific blocker surfaces.

## Consequences
- Planning docs and code-facing READMEs stop using front-runner language for the editor.
- Anchor healing under edits rides on ProseMirror transaction `Mapping`.
- Derived entity highlights and quiet annotation underlines are ProseMirror `Decoration` objects.
- The history layer in ADR-006 can assume `Step` as a stable primitive.
- The React seam question — raw ProseMirror versus a TipTap-style wrapper — lives inside this decision rather than as a cross-cutting open question.

## Decided
- ProseMirror is the editor foundation.
- Lexical is no longer under consideration.

## Open
- Whether to use raw ProseMirror or a TipTap-style React wrapper at the renderer seam.
- Which plugins belong in the Phase 2 foundational shell versus later.

## Deferred
- Any re-evaluation of the editor foundation unless a concrete ProseMirror blocker appears.
