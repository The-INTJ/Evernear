# Everlink it!

> "If I ever released this, the concept of 'Everlink it!' is fun." (Drew, 2026-10-27)

This file keeps the idea of **Everlink it!** now that its code is deleted. It is Markdown on purpose: Drew asked for this concept to be preserved in Markdown, an explicit exception to the repo's HTML-first documentation rule.

## Why the code is gone

On 2026-10-27 Evernear went back to the basics ([back-to-basics-plan.html](back-to-basics-plan.html)). The basic loop is two actions:

1. Select a phrase and choose **New entity**. The entity starts with the regex for that phrase.
2. In any document, select a passage and choose **Add slice**.

Together they cover what Everlink did in one guided flow, with far less code. Everlink was about 700 lines across five files, and it lived in the side panel, which was removed.

Drew's reasoning: the concept is worth keeping for a release; the implementation was not worth keeping while the basics get nailed down.

## The concept

Everlink it! was selection-driven authoring that went from story to lore in one motion:

- Select a word or phrase in the manuscript ("The Spire") and choose **Everlink it!**
- A chooser asks which entity this is: an existing one, or a new one named after the selection. The selection becomes one of the entity's matching rules if it isn't one already.
- Pick a target document: a recent one, any other, or a new lore document created on the spot ("The Spire Notes").
- The target document opens beside the manuscript with **pending rails**: whatever you select there, or the cursor position, is the slice-to-be, drawn in its own pending color.
- **Commit** anchors the slice. If you only placed a cursor, the selected phrase is typed in for you, so an empty lore page becomes a slice in one keystroke.
- When the selection already matched an entity, the button read **Edit Everlink** instead.

What made it fun: you never left the writing flow. Noticing a new name and giving it a home in the lore took one gesture, and the lore page started itself.

## If it comes back

- Build it from the two primitives, New entity (entity plus regex) and Add slice (an anchor in a document). Everlink should be a guided sequence of the two, not its own storage path.
- Keep the invariant in `src/renderer/state/sliceCommit.ts`: build the anchor from the editor's own snapshot after flushing saves, never from a database read.
- Panels are paused. A comeback needs somewhere to show the target document that isn't a second editor on a document already open in the main viewport: two live editors on one document overwrite each other's saves.

## Where the code was

Last present on `master` at `ec46f08` (2026-05-22):

- `src/renderer/state/useEverlinkSession.ts`, `usePendingPlacement.ts`, `useEverlinkPlacement.ts`
- `src/renderer/features/entities/EverlinkPanel.tsx`
- `src/renderer/features/panes/SlicePlacementPanel.tsx`
- The feature brief is FB-001 in [docs-index.html](docs-index.html#docs-fb-001-selection-driven-everlink).
