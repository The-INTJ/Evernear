# FOR_HUMAN_BUSINESS--DOC

## Last change
2026-04-17: restored the load-bearing product risks, linked annotations to the same anchoring problem as slice boundaries, and shifted the editor recommendation toward ProseMirror.

## Current core
Evernear is a local-first desktop writing environment for complex fiction, especially fantasy.
Its job is not merely to store prose. Its job is to reduce context re-entry pain when a writer returns to an old project after time away.
The core product loop is:

- write or reread story text
- see meaningful entities surface as derived highlights in context
- preview related slices without leaving flow
- open a persistent panel for deeper reference when needed

## Important structure
- The product is organized around `Project`, `Document`, `Entity`, `MatchingRule`, `Slice`, `SliceBoundary`, `TextAnchor`, `Annotation`, and `Panel/LayoutState`.
- `TextAnchor` is the load-bearing idea behind both reusable slice boundaries and direct document annotations.
- An annotation is a quiet personal note anchored straight to the main document, not a collaborative comment system and not a second-class afterthought.
- The app is organized around `main`, `preload`, `renderer`, `shared`, and `db` so product ideas map cleanly to runtime boundaries.
- The repo is intentionally doc-only right now. Each future code folder contains markdown that explains what will eventually live there and what broader docs to read first.
- SQLite is the current canonical project store, with explicit author-ownership protections through export/package support.
- Highlights are derived from entity matches and should not become stored records.

## Truthful MVP
- Open a local project.
- Create and edit documents.
- Create entities with matching rules and associate them with slices.
- Match entities inside story text and render derived highlights.
- Use hover to open a modal with the slice viewer and click to open a persistent panel.
- Persist enough local state that the workflow survives closing and reopening the app.

The full annotation surface can land after the central loop proves itself, but its design cannot wait because it rides on the same anchoring substrate as slice boundaries.

## Major risks
- Shared anchor healing under live edits could fail in ways that break both slice boundaries and annotations.
- Too much entity highlighting can make the document harder to read.
  - This is intentional if one turns on all entities. Grouping, filtering, and contrast controls can keep it useful.
- Matching normalization can become either too weak to trust or too aggressive to trust, especially with aliases, capitalization, and possessives.
- SQLite-first storage can feel opaque if export and ownership are treated as an afterthought.

## Future considerations
- Boundary editing and reusable slice-boundary management.
- `All Slices` mode, overlap inspection, and merge/link workflows.
- Annotation style controls built on the same shared anchor substrate.
- Better panel persistence and multi-monitor friendliness.
- Full document view from a slice inside the panel.
- Shared-slice and co-occurrence graph views later if they prove useful.
- Strong project export/import so the app remains respectful of author ownership.

## Decided
- Desktop-first, local-first, single-user-first.
- The product is story-centric and entity-aware, not a generic notes tool.
- Entities define meaning, not visuals.
- Highlights are derived, never stored.
- Modal and panel are different views over the same slice data.
- The working stack baseline is Electron, React, TypeScript, Vite, ProseMirror as the current editor front-runner, and SQLite.
- The repo should show a real future-ish app structure now, even before code exists.

## Open
- How aggressive entity highlighting should be before it becomes visual spam.
  - For the words, an author can group entities. For a document, seeing all linked boundaries can be a toggle.
- What exact project packaging/export format best balances portability and simplicity.
- How much boundary editing and annotation authoring belong in the first build that proves the product loop.

## Deferred
- Collaboration workflows.
- Cloud sync.
- Plugin ecosystems.
- Mobile.
- AI-assisted authoring as a core product identity.
  - We will never do this.
