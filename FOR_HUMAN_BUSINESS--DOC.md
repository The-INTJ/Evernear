# FOR_HUMAN_BUSINESS--DOC

## Last change
2026-04-19: marked the Phase 0 "doc-only" note below as historical — the repo has had runnable code since commit `d0ea627` and is now in Phase 1.5 foundation-hardened shape.
2026-04-17: defined selection-driven Everlink authoring as selection-bootstrapped entity plus slice creation with panel-based target editing and fail-closed anchor repair.
2026-04-17: defined document organization as folders plus generic documents, reserved anchored outline nodes, and made clean copy/paste plus future slice-preserving text transfer phase-zero concerns.
2026-04-17: cleaned the merged planning pass, aligned the history promise with the actual MVP architecture, and removed stale editor-choice language.
2026-04-17: clarified entities as match-rule and slice libraries, made matching explicitly live rather than precomputed, and added Pretext as an exploratory layout spike.
2026-04-17: locked ProseMirror in as the editor foundation and added event-sourced history as part of the product's ownership and re-entry promises.

## Current core
Evernear is a local-first desktop writing environment for complex fiction, especially fantasy.
Its job is not merely to store prose. Its job is to reduce context re-entry pain when a writer returns to an old project after time away.
The core product loop is:

- write or reread story text
- see meaningful entities surface as derived highlights in context
- preview related slices without leaving flow
- open a persistent panel for deeper reference when needed

A quieter but foundational promise supports the loop: a writer's work is never lost or flattened. Every prose change, entity definition, matching rule, slice, and boundary is captured in append-only history that can later support a unified timeline.
The first writing workflow must also respect how real projects arrive: paste in a huge manuscript, paste in world docs, organize them without ceremony, and still be able to `Ctrl+A` and `Ctrl+C` clean prose back out whenever needed.

## Important structure
- The product is organized around `Project`, `DocumentFolder`, `Document`, `DocumentOutlineNode`, `Entity`, `MatchingRule`, `Slice`, `SliceBoundary`, `TextAnchor`, `Annotation`, and `Panel/LayoutState`.
- `DocumentFolder` and later `DocumentOutlineNode` exist to organize navigation and re-entry; they do not define meaning.
- An `Entity` owns a list of things that should match in text plus the library of slices those matches should open.
- Manual `Everlink it!` authoring is allowed as a bootstrap into entity truth, but it must create or extend the entity and slice model rather than leave stored hyperlink markup behind in the manuscript.
- Documents stay generic in the first build. `book`, `part`, `chapter`, and `section` belong to outline navigation later, not to a behavior-heavy document taxonomy now.
- `TextAnchor` is the load-bearing idea behind both reusable slice boundaries and direct document annotations.
- Slice boundaries are stored as anchored ranges with exact text plus context and an optional coarse jump hint; line or position readouts may help the UI, but they are not the truth that later repair trusts.
- A future text-transfer seam must be able to preserve slice meaning across move or copy workflows without making ordinary editing or clipboard behavior weird in the meantime.
- An annotation is a quiet personal note anchored straight to the main document, not a collaborative comment system and not a second-class afterthought.
- The app is organized around `main`, `preload`, `renderer`, `shared`, and `db` so product ideas map cleanly to runtime boundaries.
- The runnable Phase 1.5 app implements this organization with strict boundaries enforced by ESLint; each source folder has a canonical README explaining its ownership and chain-up reads.
- SQLite is the canonical project store, with explicit author-ownership protections through export and package support that carries history, not just current state.
- Highlights are derived from entity matches and should not become stored records.
- History is event-sourced: an append-only domain event log plus the ProseMirror step log are the canonical record; the tables writers query are rebuildable projections.

## Truthful MVP
- Open a local project.
- Organize material with folders and generic documents.
- Paste in large story or reference text and edit it normally.
- Copy clean prose back out with ordinary select-all and copy behavior.
- Create entities with matching rules and associate them with slices.
- Bootstrap a new entity or extend an existing one from selected story text through `Everlink it!`, without any fuzzy auto-reuse of merely similar entities.
- Live-calculate entity matches inside visible story text and render derived highlights when highlighting is enabled.
- Use hover to open a modal with the slice viewer and click to open a persistent panel.
- Place and edit new slice content inside a panel document view, with empty pending slices auto-filling from the source selection on commit or blur.
- Persist enough local state that the workflow survives closing and reopening the app.
- Capture history from day one, even if the first visible surface is only a simple restore-previous-version action after MVP.

The full annotation surface can land after the central loop proves itself, but its design cannot wait because it rides on the same anchoring substrate as slice boundaries. Internal outline navigation can land after that same anchor model proves itself, because it should reuse the anchored substrate rather than inventing a second positioning system. The full timeline UI can land after the truthful MVP, but the history plumbing cannot, because retrofitting it would mean rewriting the write path.

## Major risks
- Shared anchor healing under live edits could fail in ways that break both slice boundaries and annotations.
- Duplicate or heavily revised lore text could make slice repair drift unless ambiguous anchor resolution fails closed.
- Too much entity highlighting can make the document harder to read.
- Matching normalization can become either too weak to trust or too aggressive to trust, especially with aliases, capitalization, and possessives.
- Long-document layout and viewport tracking can become more expensive than the matching itself if the app has to keep asking the DOM where text lives.
- A too-clever organization model could accidentally recreate heavyweight binder software before the core writing loop earns it.
- Editor-specific copy or paste behavior could make imported prose feel trapped instead of owned.
- SQLite-first storage can feel opaque if export and ownership are treated as an afterthought, and history doubles what export must carry.
- Event-sourced history pays off only if every mutation writes through the log; any backdoor around it silently corrupts the guarantee.

## Future considerations
- Internal outline nodes for `book`, `part`, `chapter`, `section`, or custom navigation inside a large document.
- Boundary editing and reusable slice-boundary management.
- `All Slices` mode, overlap inspection, and merge or link workflows.
- Annotation style controls built on the same shared anchor substrate.
- Slice-preserving text transfer such as `Move Slice` once anchors, clipboard provenance, and history are trustworthy enough.
- Whether Pretext materially improves long-document layout and visible-range tracking.
- Better panel persistence and multi-monitor friendliness.
- Full document view from a slice inside the panel.
- Shared-slice and co-occurrence graph views later if they prove useful.
- Strong project export and import that carries history so the app remains respectful of author ownership.
- A writer-facing timeline that unifies prose edits and metadata changes.
- Named checkpoints such as "before Chapter 3 rewrite."

## Decided
- Desktop-first, local-first, single-user-first.
- The product is story-centric and entity-aware, not a generic notes tool.
- The first organization model is a lightweight tree of folders plus generic documents.
- Organization is orthogonal to entity semantics.
- Copy/paste portability matters more than editor-local cleverness.
- Entities define meaning, not visuals.
- Matches are live-calculated from current text when needed, never stored or precomputed as document truth.
- Highlights are derived, never stored.
- Modal and panel are different views over the same slice data.
- The working stack baseline is Electron, React, TypeScript, Vite, ProseMirror, and SQLite.
- History is event-sourced. Writers eventually get time travel over prose and metadata on the same timeline.
- The first visible history surface can be a minimal restore-previous-version action; the broader timeline comes later.
- Merge, conflict resolution, and collaboration are permanently out of scope.

## Open
- How aggressive entity highlighting should be before it becomes visual spam.
- What the first folder and tree interaction model should feel like in the everyday writing workflow.
- What exact project packaging and export format best balances portability and simplicity when history must travel with the project.
- Whether Pretext changes the long-document rendering or document-view strategy enough to reshape the current layout recommendation.
- How explicit outline-node authoring should be once anchored document navigation lands.
- How much boundary editing and annotation authoring belong in the first build that proves the product loop.
- How much history UI ships with the truthful MVP beyond the underlying storage.

## Deferred
- Collaboration workflows.
- Cloud sync.
- Plugin ecosystems.
- Mobile.
- AI-assisted authoring as a core product identity.
- Branching as a visible product feature.
