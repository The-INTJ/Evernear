# FOR_HUMAN_CODE--DOC

## Last change
2026-04-17: clarified entities as rule libraries plus slice libraries, made matching explicitly live and non-persistent, and added Pretext as an exploratory layout option.

## Current recommendation
Build Evernear as a single desktop app repo with strong source boundaries:

- `src/main`: Electron app lifecycle, project open/load, window creation, IPC registration
- `src/preload`: the narrow bridge between privileged code and the renderer
- `src/renderer`: React UI, panel orchestration, and feature composition
- `src/shared`: canonical domain language and cross-runtime contracts
- `src/db`: SQLite schema direction, repositories, migrations, and export logic

This keeps the repo approachable while still giving clear seams for future extraction if the codebase earns it.

## Stack baseline
- Electron: practical desktop shell with familiar tooling and good AI/codegen support
- React + TypeScript + Vite: fast iteration, readable component model, clear type surfaces
- ProseMirror: better current fit for transactions, range mapping, decorations, and anchored-range workflows
- SQLite: local-first storage with transactional reads/writes and rich querying for entity-aware workflows

Lexical is still worth a small gut-check, but it is no longer the default recommendation just because it was named first.
Pretext is worth an explicit spike before locking long-document layout and visible-range mapping strategy.

## Runtime boundaries
| Area | Owns | Should stay out of |
| --- | --- | --- |
| `main` | app lifecycle, filesystem entrypoints, database bootstrap, window policy | React UI state, editor internals |
| `preload` | tiny typed bridge, validation, least-privilege exposure | business logic, persistence policy |
| `renderer` | interaction model, panels, editor host, view state | raw SQL, broad filesystem access |
| `shared` | domain terms, DTOs, contracts, common validation rules | platform-specific behavior |
| `db` | schema, queries, repositories, migrations, export/import mechanics | UI composition, renderer-driven state |

## Domain vocabulary
| Concept | Meaning now | Likely stable fields later |
| --- | --- | --- |
| `Project` | local story workspace | id, name, path, preferences, timestamps |
| `Document` | editable story/lore/reference unit | id, title, kind, contentFormat, contentJson, plainText, ordering |
| `Entity` | semantic definition used to detect and resolve references in text and open related context | id, name, scope, timestamps |
| `MatchingRule` | literal, alias, or pattern rule used by an entity to match text | id, entityId, ruleType, pattern, normalization |
| `TextAnchor` | durable selector payload that can re-find a document range after nearby edits | documentId, from, to, quote, prefix, suffix, blockPath, versionSeen |
| `Slice` | reference to a bounded piece of content or a whole document | id, sourceKind, sourceId, boundaryId, label |
| `SliceBoundary` | reusable anchored range inside a document | id, documentId, anchor, timestamps |
| `EntitySlice` | many-to-many association between entities and slices | entityId, sliceId, ordering |
| `Highlight` | derived visual effect when a matching rule hits text | computed from matching results, never stored |
| `SliceViewer` | scrollable sequence of slices for one entity | shared by modal and panel surfaces |
| `Modal` | temporary hover preview surface | shows the slice viewer and disappears on mouse exit |
| `Panel` | persistent expanded surface opened from a highlight | can host the slice viewer and a deeper document view |
| `DocumentView` | full document shown from a slice inside a panel | can show active or all slice boundaries |
| `Annotation` | low-noise personal note anchored directly to the document | id, documentId, anchor, body, style, timestamps |
| `Panel/LayoutState` | persistent workspace state | open items, pinned context, arrangement |

## Data and storage stance
SQLite is the canonical runtime store.
The current best-fit project shape is a local project directory that contains at least:

- a SQLite database for structured project data
- optional adjacent asset/export material
- a first-class export path so the author is never trapped in an opaque container

The database should own the working truth for documents, entities, matching rules, entity-slice links, slices, slice boundaries, annotations, and layout state.
Documents should persist as full snapshot writes, not delta streams:

- `contentFormat` identifies the editor schema family
- `contentJson` stores the canonical editor document snapshot
- `plainText` stores the denormalized text projection used by export helpers and any non-editor text utilities

Highlights should stay derived from document text plus matching results rather than becoming stored records.
Matches should never become stored or precomputed document records.
Slice boundaries should be reusable records rather than hidden inside slice blobs.
Slice boundaries and annotations should share the same `TextAnchor` payload shape even if they live in different tables.
Portability is not optional, so export/package support must be treated as a core system concern rather than a late utility.

## Editor strategy
- Use ProseMirror as the current editor-host recommendation, not as the source of product architecture.
- Keep semantic behavior composable: live matching, derived highlighting, modal preview, panel open, document view, boundary editing, and annotation rendering should remain separable concerns.
- Let slice boundaries and annotations share one anchor-healing substrate.
- Live-calculate matches from visible text when highlighting is enabled rather than precomputing whole-document match sets.
- Allow authors to disable live matching and highlighting while writing.
- Use editor decorations for derived entity highlights and quiet annotation underlines rather than storing those visuals in the document.
- Explore Pretext before locking the long-document layout and visible-range mapping design, especially for document view or virtualized reading surfaces.
- Avoid pushing database or IPC details into editor plugins.
- Prefer a renderer shell where the editor receives domain results and renders them, rather than embedding persistence logic inside editor code.
- Modal and panel should be different views over the same slice-viewer data rather than separate product models.

## Key technical tradeoffs
- SQLite-first storage simplifies querying and consistency, but raises the bar for transparent export.
- A single-app repo is simpler now, but shared code must stay clean enough that extraction would still be possible later.
- ProseMirror asks for more upfront schema and plugin discipline, but its transaction mapping and decoration model line up directly with Evernear's anchored-range problems.
- Full snapshot persistence is simpler and safer than diff-on-save or delta-stream storage for a single-user local-first product, but it makes content-schema versioning explicit work.
- Live visible-range matching keeps the product honest to the desired interaction model, but it means layout and invalidation strategy matter as much as raw regex throughput.
- Persistent panels are part of the core product loop, so layout state belongs in the early architecture even if advanced windowing does not.

## Future considerations
- The exact acceptance thresholds for anchor healing under live edits.
- Matching normalization rules, visible-range invalidation, and author-controlled highlight toggles.
- Whether Pretext materially improves long-document layout and viewport tracking enough to change the current rendering approach.
- How `All Slices` mode, overlap visualization, and boundary merge/link should behave.
- Whether project export should be plain-text-first, bundle-first, or dual-mode.

## Decided
- Single desktop app repo with clear source boundaries.
- Narrow preload API and limited IPC surface.
- SQLite-first project storage with a mandatory ownership/export story.
- React renderer and ProseMirror as the current editable-surface front-runner.
- Documents persist as full JSON snapshots plus a plain-text projection, not delta streams.
- Entities are semantic definitions, not visual objects.
- Matches are live-calculated and never stored or precomputed as document truth.
- Highlights are derived, not stored.

## Open
- Exact project folder/package format.
- Exact state-management approach inside the renderer.
- Exact migration tooling and schema evolution conventions once document snapshots are versioned.
- Exact annotation-style preference surface for authors.
- Whether Pretext belongs only in document view or changes the primary long-document rendering strategy.

## Deferred
- Multi-window sophistication beyond what the core workflow requires.
- Search/analytics features beyond immediate re-entry value.
- Graph-style relationship visualization beyond what the core workflow requires.
