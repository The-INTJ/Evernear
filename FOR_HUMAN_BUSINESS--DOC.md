# FOR_HUMAN_BUSINESS--DOC

## Last change
2026-04-17: tightened the product language around semantic entities, slices, reusable boundaries, and derived highlights.

## Current core
Evernear is a local-first desktop writing environment for complex fiction, especially fantasy.
Its job is not merely to store prose. Its job is to reduce context re-entry pain when a writer returns to an old project after time away.
The core product loop is:

- write or reread story text
- see meaningful entities surface as derived highlights in context
- preview related slices without leaving flow
- open a persistent panel for deeper reference when needed

## Important structure
- The product is organized around `Project`, `Document`, `Entity`, `MatchingRule`, `Slice`, `SliceBoundary`, `Annotation`, and `Panel/LayoutState`.
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

Boundary editing, `All Slices` mode, overlap visualization, and annotations remain important, but they do not have to land in the very first build that proves the product loop.

## Major risks
- Too much entity highlighting can make the document harder to read.
  - This is intentional if one turns on ALL entities. Grouping and filtering can prevent this; plus a slider for "contrast" that pushes all highlights towards the text color / background color.
- SQLite-first storage can feel opaque if export and ownership are treated as an afterthought.

## Future considerations
- Boundary editing and reusable slice-boundary management.
- `All Slices` mode, overlap inspection, and merge/link workflows.
- Low-noise personal annotations.
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
- The working stack baseline is Electron, React, TypeScript, Vite, Lexical, and SQLite.
- The repo should show a real future-ish app structure now, even before code exists.

## Open
- How aggressive entity highlighting should be before it becomes visual spam.
  - This is not a concern. For the words, an author can group entities. For a document, seeing "all linked boundaries" can be a toggle.
- What exact project packaging/export format best balances portability and simplicity.
- How much boundary editing needs to be in the truthful MVP versus immediately after it.

## Deferred
- Collaboration workflows.
- Cloud sync.
- Plugin ecosystems.
- Mobile.
- AI-assisted authoring as a core product identity.
  - We will never do this.
