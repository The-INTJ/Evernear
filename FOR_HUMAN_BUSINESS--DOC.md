# FOR_HUMAN_BUSINESS--DOC

## Last change
2026-04-17: locked ProseMirror in as the editor foundation and added event-sourced history as part of the product's ownership and re-entry promises.

## Current core
Evernear is a local-first desktop writing environment for complex fiction, especially fantasy.
Its job is not merely to store prose. Its job is to reduce context re-entry pain when a writer returns to an old project after time away.
The core product loop is:

- write or reread story text
- see meaningful entities surface as derived highlights in context
- preview related slices without leaving flow
- open a persistent panel for deeper reference when needed

A quieter but foundational promise supports the loop: a writer's work is never lost or flattened. Every prose change, entity definition, matching rule, slice, and boundary is captured in an append-only history that the writer can scrub back through.

## Important structure
- The product is organized around `Project`, `Document`, `Entity`, `MatchingRule`, `Slice`, `SliceBoundary`, `TextAnchor`, `Annotation`, and `Panel/LayoutState`.
- `TextAnchor` is the load-bearing idea behind both reusable slice boundaries and direct document annotations.
- An annotation is a quiet personal note anchored straight to the main document, not a collaborative comment system and not a second-class afterthought.
- The app is organized around `main`, `preload`, `renderer`, `shared`, and `db` so product ideas map cleanly to runtime boundaries.
- The repo is intentionally doc-only right now. Each future code folder contains markdown that explains what will eventually live there and what broader docs to read first.
- SQLite is the current canonical project store, with explicit author-ownership protections through export/package support that carries history, not just current state.
- Highlights are derived from entity matches and should not become stored records.
- History is event-sourced: an append-only event log plus the ProseMirror step log are the canonical record; the tables a writer's queries hit are rebuildable projections.

## Truthful MVP
- Open a local project.
- Create and edit documents.
- Create entities with matching rules and associate them with slices.
- Match entities inside story text and render derived highlights.
- Use hover to open a modal with the slice viewer and click to open a persistent panel.
- Persist enough local state that the workflow survives closing and reopening the app.
- Capture history from day one — even if the visible UI for it is only a simple restore-previous-version action immediately after MVP.

The full annotation surface can land after the central loop proves itself, but its design cannot wait because it rides on the same anchoring substrate as slice boundaries. The full timeline UI can land after the truthful MVP, but the history plumbing cannot, because retrofitting it would mean rewriting the write path.

## Major risks
- Shared anchor healing under live edits could fail in ways that break both slice boundaries and annotations.
- Too much entity highlighting can make the document harder to read.
  - This is intentional if one turns on all entities. Grouping, filtering, and contrast controls can keep it useful.
- Matching normalization can become either too weak to trust or too aggressive to trust, especially with aliases, capitalization, and possessives.
- SQLite-first storage can feel opaque if export and ownership are treated as an afterthought, and history doubles what export must carry.
- Event-sourced history pays off only if every mutation writes through the log; any backdoor around it silently corrupts the guarantee.

## Future considerations
- Boundary editing and reusable slice-boundary management.
- `All Slices` mode, overlap inspection, and merge/link workflows.
- Annotation style controls built on the same shared anchor substrate.
- Better panel persistence and multi-monitor friendliness.
- Full document view from a slice inside the panel.
- Shared-slice and co-occurrence graph views later if they prove useful.
- Strong project export/import that carries history so the app remains respectful of author ownership.
- A writer-facing timeline that unifies prose edits and metadata changes.
- Named checkpoints such as "before Chapter 3 rewrite."

## Decided
- Desktop-first, local-first, single-user-first.
- The product is story-centric and entity-aware, not a generic notes tool.
- Entities define meaning, not visuals.
- Highlights are derived, never stored.
- Modal and panel are different views over the same slice data.
- The working stack baseline is Electron, React, TypeScript, Vite, ProseMirror, and SQLite.
- History is event-sourced. Writers get time travel over prose and metadata on the same timeline.
- Merge, conflict resolution, and collaboration are permanently out of scope.
- The repo should show a real future-ish app structure now, even before code exists.

## Open
- How aggressive entity highlighting should be before it becomes visual spam.
  - For the words, an author can group entities. For a document, seeing all linked boundaries can be a toggle.
- What exact project packaging/export format best balances portability and simplicity when history must travel with the project.
- How much boundary editing and annotation authoring belong in the first build that proves the product loop.
- How much history UI ships with the truthful MVP beyond the underlying storage.

## Deferred
- Collaboration workflows.
- Cloud sync.
- Plugin ecosystems.
- Mobile.
- AI-assisted authoring as a core product identity.
  - We will never do this.
- Branching as a visible product feature.
