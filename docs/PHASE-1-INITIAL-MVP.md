# Initial MVP for Phase 1

## Status
Planned

## Date
2026-04-17

## Parent reads
- [FOR_HUMAN_BUSINESS--DOC.md](../FOR_HUMAN_BUSINESS--DOC.md)
- [FOR_HUMAN_AND_AI_ROADMAP--DOC.md](../FOR_HUMAN_AND_AI_ROADMAP--DOC.md)
- [ADR-003: Document Persistence and Editor State](./adr/ADR-003-document-persistence-and-editor-state.md)
- [ADR-004: Prove Load-Bearing Risks Before Phase 2](./adr/ADR-004-prove-load-bearing-editor-risks-before-phase-2.md)
- [ADR-006: Event-Sourced Document and Metadata History](./adr/ADR-006-event-sourced-document-and-metadata-history.md)

## Why this exists
Phase 1 has several load-bearing spikes, but the first executable deliverable should be smaller than "do all of Phase 1."
We need one buildable artifact that proves a real architectural claim and gives later spikes a stable place to stand.

Note: The AI will never directly manage or execute over prose. The amount of text would destroy context windows and consume usage quotas.

Use small text amounts for any testing the AI does; delegate to the human to place and paste in the 50k+ word fixture that proves real-world behavior.

## Proposed deliverable
Build a **single-document round-trip harness**:

- one local desktop harness window
- one ProseMirror editor surface
- one SQLite-backed document row
- one realistic long-form manuscript fixture at 50k+ words
  - DO NOT generate this; tell the human where to place the 50k after. Consuming document text will anhhilate tokens.
- one save and reload path using snapshot plus plain-text projection
- one decoration toggle that simulates derived highlights and slice-boundary chrome without storing them in document truth
- one clean-copy verification flow using ordinary `Ctrl+A` and `Ctrl+C`

This is intentionally not the truthful MVP and not the foundational shell.
It is a narrow proof build meant to answer whether Evernear's document seam is honest under realistic prose size and realistic clipboard behavior.

## Proof question
Can Evernear store a large ProseMirror document as a SQLite snapshot plus plain-text projection, reload it cleanly, and still let writers copy clean prose out even when renderer-only decorations are visible?

## What this should prove
- The document persistence seam from [ADR-003](./adr/ADR-003-document-persistence-and-editor-state.md) is workable in practice, not just on paper.
- A 50k+ word manuscript can paste in, save, reload, and remain editable without obvious degradation.
- Renderer-only highlights or boundary chrome do not contaminate clipboard output.
- `plainText` is trustworthy enough to act as the non-editor projection for export and verification helpers.
- Future history work can reuse this harness rather than starting from an abstract schema discussion.

## Non-goals
- Multi-document or folder workflows.
- Entity creation, matching-rule authoring, or real Everlink behavior.
- Shared anchor healing for slices or annotations.
- Event-log plus step-log replay.
- Panel, modal, or layout polish.
- Settling the final app shell architecture.

## Scope
### In scope
- Launch a minimal local harness with Electron, React, TypeScript, Vite, ProseMirror, and SQLite.
- Open a single document from SQLite or seed it on first run.
- Paste or load a 50k+ word manuscript fixture.
- Save `contentFormat`, `contentSchemaVersion`, `contentJson`, and `plainText`.
- Reload the document and verify snapshot and plain-text round-trip.
- Toggle simulated derived decorations over the document.
- Verify that select-all plus copy yields plain prose, not markup or UI artifacts.
- Capture rough timings for paste, save, and reload.

### Out of scope
- Any stored entity or slice truth.
- Any persisted highlight records.
- Any "smart" matching.
- Any time-travel UI.
- Any collaboration or export packaging.

## Demo script
1. Launch the harness against a fresh local SQLite file.
2. Load or paste a 50k+ word manuscript into the editor.
3. Save the document and show the persisted head row.
4. Close and reopen the harness, then reload the same document.
5. Turn simulated highlights and boundary rails on.
6. Use ordinary `Ctrl+A` and `Ctrl+C`.
7. Paste into a plain-text verification surface and confirm the copied text matches expected prose, not decorated output.
8. Report paste, save, reload, and copy verification results in one short run log.

## Exit criteria
- The same manuscript can complete paste, save, close, reopen, and reload without structural corruption.
- The saved `plainText` matches the editor's plain-text extraction for the document.
- Decoration toggles do not change the copied text result.
- The editor remains usable on the long-form fixture after reload.
- Save and reload are fast enough to feel normal for a proof harness, even if exact budgets change later.
- The harness leaves behind concrete notes on what failed, what felt slow, and what must change before broader Phase 1 work.

## Suggested working targets
These are execution targets, not permanent product promises:

- save should usually feel sub-second on the long fixture
- reload should usually feel sub-second on the long fixture
- copied text should match expected prose exactly in the verification surface
- the harness should reveal whether slowdown comes from editor state, SQLite writes, plain-text extraction, or decoration rendering

## Build slices
1. **Harness shell**
   Minimal window, editor mount, local database bootstrap, and a tiny command surface for load, save, reload, and decoration toggle.
2. **Persistence seam**
   One `documents` table plus the repository code that writes snapshot and plain-text projection together.
3. **Fixture path**
   A realistic manuscript sample and a repeatable way to seed or paste it.
4. **Decoration simulation**
   Fake derived highlights and boundary rails that exercise renderer-only chrome without introducing semantic truth.
5. **Verification log**
   A lightweight result summary covering save, reload, clipboard cleanliness, and any obvious pain points.

## Why this first
This is the smallest deliverable that proves multiple roadmap bullets at once:

- document snapshot round-tripping through SQLite
- 50k+ word paste-in and save-reload behavior
- clean copy-out even with renderer decorations present

It also creates a concrete platform for later experiments instead of forcing every Phase 1 spike to bootstrap editor, storage, and fixture handling from scratch.

## What passing unlocks
- Safer movement into the rest of Phase 1 proof work.
- A real code path for [EXP-005](./experiments/EXP-005-event-log-and-checkpoint-replay.md) to build on.
- Better confidence that Phase 2 shell work will not hide a document-storage rewrite risk.

## What failure would teach us
- If snapshot reload is fragile, the storage seam is wrong before the app gets bigger.
- If clean copy fails under decoration, the editor integration is violating a core product promise.
- If 50k+ word behavior is already uncomfortable here, later matching and anchor work will only make it worse.
- If `plainText` drifts from the editor state, export and verification cannot be trusted yet.
