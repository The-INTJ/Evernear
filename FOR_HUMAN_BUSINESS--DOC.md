# FOR_HUMAN_BUSINESS--DOC

## Last change
2026-04-16: established the doc-only blueprint, real app-style folder tree, and first permanent architecture decisions.

## Current core
Evernear is a local-first desktop writing environment for complex fiction, especially fantasy.
Its job is not merely to store prose. Its job is to reduce context re-entry pain when a writer returns to an old project after time away.
The core product loop is:

- write or reread story text
- see meaningful entities surfaced in context
- preview related context without leaving flow
- pin or open deeper reference material when needed

## Important structure
- The product is organized around `Project`, `Document`, `Entity`, `Slice`, `Annotation`, `SemanticCategory`, and `Pane/LayoutState`.
- The app is organized around `main`, `preload`, `renderer`, `shared`, and `db` so product ideas map cleanly to runtime boundaries.
- The repo is intentionally doc-only right now. Each future code folder contains markdown that explains what will eventually live there and what broader docs to read first.
- SQLite is the current canonical project store, with explicit author-ownership protections through export/package support.

## Truthful MVP
- Open a local project.
- Create and edit documents.
- Create entities with aliases and a target.
- Match entities inside story text.
- Use hover for quick context and click to open target context in a side pane.
- Persist enough local state that the workflow survives closing and reopening the app.

Slice-aware targets, semantic overlays, and annotations remain important, but they do not have to land in the very first build that proves the product loop.

## Major risks
- Too much entity highlighting can make the document harder to read.
- Slice references are valuable but can become brittle if document edits make anchoring unstable.
- A rich editor can accumulate too much behavior too early and become hard to reason about.
- SQLite-first storage can feel opaque if export and ownership are treated as an afterthought.

## Future considerations
- Slice-aware references as a first-class differentiator.
- Semantic overlays, categories, legends, and filtering for re-entry.
- Low-noise personal annotations.
- Better pane persistence and multi-monitor friendliness.
- Strong project export/import so the app remains respectful of author ownership.

## Decided
- Desktop-first, local-first, single-user-first.
- The product is story-centric and entity-aware, not a generic notes tool.
- The working stack baseline is Electron, React, TypeScript, Vite, Lexical, and SQLite.
- The repo should show a real future-ish app structure now, even before code exists.

## Open
- How aggressive entity highlighting should be before it becomes visual spam.
- What exact project packaging/export format best balances portability and simplicity.
- When slice awareness should move from "important soon" into the truthful MVP itself.

## Deferred
- Collaboration workflows.
- Cloud sync.
- Plugin ecosystems.
- Mobile.
- AI-assisted authoring as a core product identity.
