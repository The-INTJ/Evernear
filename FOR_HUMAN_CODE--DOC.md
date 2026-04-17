# FOR_HUMAN_CODE--DOC

## Last change
[RESOLVE]
2026-04-17: clarified entities as rule libraries plus slice libraries, made matching explicitly live and non-persistent, and added Pretext as an exploratory layout option.
2026-04-17: locked ProseMirror in as the editor foundation after EXP-003 and EXP-004 resolved, and added the event-sourced history subsystem as a first-class architectural concern.

## Current recommendation
Build Evernear as a single desktop app repo with strong source boundaries:

- `src/main`: Electron app lifecycle, project open/load, window creation, IPC registration
- `src/preload`: the narrow bridge between privileged code and the renderer
- `src/renderer`: React UI, panel orchestration, and feature composition
- `src/shared`: canonical domain language and cross-runtime contracts
- `src/db`: SQLite schema direction, repositories, projections, migrations, and export logic

This keeps the repo approachable while still giving clear seams for future extraction if the codebase earns it.

## Stack baseline
- Electron: practical desktop shell with familiar tooling and good AI/codegen support
- React + TypeScript + Vite: fast iteration, readable component model, clear type surfaces
- ProseMirror: the editor foundation — transaction `Mapping`, `Decoration`, and `Step` are load-bearing primitives for anchor healing, derived highlights, and document history
- SQLite: local-first storage with transactional reads/writes, append-only event and step logs, and rich querying for entity-aware workflows
[RESOLVE]
Lexical is still worth a small gut-check, but it is no longer the default recommendation just because it was named first.
Pretext is worth an explicit spike before locking long-document layout and visible-range mapping strategy.
Evidence for the editor choice lives in [EXP-003](./docs/experiments/EXP-003-lexical-prototype-walkthrough.md) and [EXP-004](./docs/experiments/EXP-004-prosemirror-prototype-walkthrough.md); the lock-in is recorded as [ADR-005](./docs/adr/ADR-005-editor-foundation-locked-to-prosemirror.md). The history approach is recorded as [ADR-006](./docs/adr/ADR-006-event-sourced-document-and-metadata-history.md) and its proof work as [EXP-005](./docs/experiments/EXP-005-event-log-and-checkpoint-replay.md).

## Runtime boundaries
| Area | Owns | Should stay out of |
| --- | --- | --- |
| `main` | app lifecycle, filesystem entrypoints, database bootstrap, window policy | React UI state, editor internals |
| `preload` | tiny typed bridge, validation, least-privilege exposure | business logic, persistence policy |
| `renderer` | interaction model, panels, editor host, view state | raw SQL, broad filesystem access |
| `shared` | domain terms, DTOs, contracts, common validation rules | platform-specific behavior |
| `db` | schema, logs, projections, repositories, migrations, export/import mechanics | UI composition, renderer-driven state |

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

### History vocabulary
| Concept | Meaning now | Notes |
| --- | --- | --- |
| `EventStream` | append-only sequence of domain events for a project or aggregate | canonical truth for metadata history |
| `Event` | one typed semantic mutation on an aggregate | examples: `EntityRenamed`, `BoundaryMoved`, `SliceReassigned` |
| `DocumentStep` | one ProseMirror `Step` with its inverse | canonical truth for document-content history |
| `DocumentCheckpoint` | full document snapshot at a given version | reuses the ADR-003 snapshot row as the checkpoint primitive |
| `Projection` | current-state table materialized from the logs and checkpoints | convenience for queries, never the truth |
| `Timeline` | unified chronological view of events and document steps | the writer-facing narrative of what changed when |

## Data and storage stance
SQLite is the canonical runtime store.
The current best-fit project shape is a local project directory that contains at least:

- a SQLite database for structured project data, append-only event and step logs, and document checkpoints
- optional adjacent asset/export material
- a first-class export path so the author is never trapped in an opaque container, and that path must include history

The database owns a **log-first model** for working truth. Every mutation is appended to the domain event log or the ProseMirror step log (or both, in one transaction) before projections are updated. Current-state tables for documents, entities, matching rules, entity-slice links, slices, slice boundaries, annotations, and layout state are **projections** of those logs plus the latest document checkpoints, and they must be rebuildable from scratch.

Document rows keep the shape established by ADR-003:

- `contentFormat` identifies the editor schema family
[RESOLVE]
- `contentJson` stores the canonical editor document snapshot
- `plainText` stores the denormalized text projection used by export helpers and any non-editor text utilities
- `contentSchemaVersion` identifies the stored snapshot version
- `contentJson` stores the canonical structured document snapshot
- `plainText` stores the denormalized text projection used by matching, search, and export helpers

Highlights should stay derived from document text plus matching results rather than becoming stored records.
Matches should never become stored or precomputed document records.
Slice boundaries should be reusable records rather than hidden inside slice blobs.
Slice boundaries and annotations should share the same `TextAnchor` payload shape even if they live in different tables.
Portability is not optional, so export/package support must be treated as a core system concern rather than a late utility.
Those snapshot writes double as **checkpoints** in the history model. Opening a document at any version uses the nearest checkpoint plus forward Step replay.

Highlights stay derived from document text plus matching results rather than becoming stored records.
Slice boundaries stay reusable records rather than hidden inside slice blobs.
Slice boundaries and annotations share the same `TextAnchor` payload shape, and their positions migrate forward through ProseMirror's `Mapping`. The same mechanism powers time travel when a writer views a historical document version.
Portability is not optional; export and package behavior must carry the logs and checkpoints, not just the current projection.

## Editor strategy
[RESOLVE]
- Use ProseMirror as the current editor-host recommendation, not as the source of product architecture.
- Keep semantic behavior composable: live matching, derived highlighting, modal preview, panel open, document view, boundary editing, and annotation rendering should remain separable concerns.
- Use ProseMirror as the editor foundation. Do not treat this as provisional.
- Treat ProseMirror's `Decoration` API as the home for derived highlights and quiet annotation underlines; neither is persisted inside the document.
- Treat ProseMirror's `Step` and `Mapping` as the document-content primitives for both live anchor migration and the history layer.
- Keep semantic behavior composable: matching, derived highlighting, modal preview, panel open, document view, boundary editing, and annotation rendering stay separable concerns.
- Let slice boundaries and annotations share one anchor-healing substrate.
- Live-calculate matches from visible text when highlighting is enabled rather than precomputing whole-document match sets.
- Allow authors to disable live matching and highlighting while writing.
- Use editor decorations for derived entity highlights and quiet annotation underlines rather than storing those visuals in the document.
- Explore Pretext before locking the long-document layout and visible-range mapping design, especially for document view or virtualized reading surfaces.
- Avoid pushing database or IPC details into editor plugins.
- Prefer a renderer shell where the editor receives domain results and renders them, rather than embedding persistence logic inside editor code.
- Modal and panel should be different views over the same slice-viewer data rather than separate product models.
- Avoid pushing database or IPC details into editor plugins. The editor receives domain results and renders them.
- Modal and panel are different views over the same slice-viewer data rather than separate product models.
- The editor is the source of truth for emitting `DocumentStep` records into the step log, but it does not own how they are persisted.

## Key technical tradeoffs
- SQLite-first storage simplifies querying and consistency, but raises the bar for transparent export — and export must include logs and checkpoints, not just current state.
- A single-app repo is simpler now, but shared code must stay clean enough that extraction would still be possible later.
[RESOLVE]
- ProseMirror asks for more upfront schema and plugin discipline, but its transaction mapping and decoration model line up directly with Evernear's anchored-range problems.
- Full snapshot persistence is simpler and safer than diff-on-save or delta-stream storage for a single-user local-first product, but it makes content-schema versioning explicit work.
- Live visible-range matching keeps the product honest to the desired interaction model, but it means layout and invalidation strategy matter as much as raw regex throughput.
- ProseMirror asks for more upfront schema and plugin discipline, but its transaction mapping, decoration model, and `Step` primitive all line up directly with Evernear's problems and pay back across anchors, highlights, and history.
- Full snapshot persistence remains simpler and safer than pure delta-stream storage for current state, and the history layer reuses those snapshots as checkpoints rather than competing with them.
- Persistent panels are part of the core product loop, so layout state belongs in the early architecture even if advanced windowing does not.
- Event sourcing makes history honest and projections rebuildable, but every mutation path must write log and projection atomically, and projection rebuild logic must be maintained.

## Future considerations
[RESOLVE]
- The exact acceptance thresholds for anchor healing under live edits.
- Matching normalization rules, visible-range invalidation, and author-controlled highlight toggles.
- Whether Pretext materially improves long-document layout and viewport tracking enough to change the current rendering approach.
- Exact acceptance thresholds for anchor healing under live edits.
- Matching normalization rules and performance boundaries for entity detection.
- How `All Slices` mode, overlap visualization, and boundary merge/link should behave.
- Whether project export should be plain-text-first, bundle-first, or dual-mode, and how logs and checkpoints serialize in each.
- The shape of the writer-facing timeline UI.
- Checkpoint cadence beyond every explicit save.

## Decided
- Single desktop app repo with clear source boundaries.
- Narrow preload API and limited IPC surface.
[RESOLVE]
- SQLite-first project storage with a mandatory ownership/export story.
- React renderer and ProseMirror as the current editable-surface front-runner.
- Documents persist as full JSON snapshots plus a plain-text projection, not delta streams.
- SQLite-first project storage with a mandatory ownership/export story that includes history.
- React renderer and ProseMirror editor foundation.
- Documents persist as full JSON snapshots plus a plain-text projection. Those snapshots double as history checkpoints.
- Entities are semantic definitions, not visual objects.
- Matches are live-calculated and never stored or precomputed as document truth.
- Highlights are derived, not stored.
- History is event-sourced. The event log and the ProseMirror step log are canonical; current-state tables are projections.
- Branching is modeled in the log but not exposed as a product feature in MVP, and merge is permanently out of scope.

## Open
- Exact project folder/package format and how logs plus checkpoints serialize on export.
- Exact state-management approach inside the renderer.
- Exact migration tooling and schema evolution conventions, including event payload versioning.
- Exact `TextAnchor` representation in ProseMirror position space under unusual edits.
- Whether to use TipTap or raw ProseMirror at the React seam.
- Checkpoint cadence and named-checkpoint UX.
- Exact annotation-style preference surface for authors.
- Whether Pretext belongs only in document view or changes the primary long-document rendering strategy.

## Deferred
- Multi-window sophistication beyond what the core workflow requires.
- Search/analytics features beyond immediate re-entry value.
- Graph-style relationship visualization beyond what the core workflow requires.
- A writer-facing history UI beyond the simplest restore-previous-version surface.
- Any collaboration, CRDT, or merge functionality.
