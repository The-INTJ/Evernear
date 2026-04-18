# FOR_HUMAN_CODE--DOC

## Last change
2026-04-18: Phase 1.5 foundation hardening — DB layer split into per-aggregate repositories, renderer split into hooks + feature components, anchor math unified in `src/shared/anchoring.ts` (fixing an off-by-one bug in `walkNodeText`), typed event catalog, schema migration framework, Zod validation at IPC boundary, Vitest suite, ESLint with runtime-boundary enforcement. Added the "Current implementation map" section below.
2026-04-17: defined selection-driven Everlink authoring, hybrid slice anchors, and fail-closed anchor-resolution states for future implementation passes.
2026-04-17: added folders, generic documents, anchored outline nodes, and a future text-transfer provenance seam to the shared model and roadmap.
2026-04-17: cleaned the merged planning pass, removed stale editor-choice language, and completed the MVP history architecture around event logs, step logs, checkpoints, and inline projections.
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
- ProseMirror: the editor foundation; transaction `Mapping`, `Decoration`, and `Step` are load-bearing primitives for anchor healing, derived highlights, and document history
- SQLite: local-first storage with transactional reads and writes, append-only event and step logs, and rich querying for entity-aware workflows
- Pretext: worth an explicit spike before locking long-document layout and visible-range mapping strategy

Evidence for the editor choice lives in [EXP-003](./docs/experiments/resolved/EXP-003-lexical-prototype-walkthrough.md) and [EXP-004](./docs/experiments/resolved/EXP-004-prosemirror-prototype-walkthrough.md). The lock-in is recorded as [ADR-005](./docs/adr/ADR-005-editor-foundation-locked-to-prosemirror.md). The history approach is recorded as [ADR-006](./docs/adr/ADR-006-event-sourced-document-and-metadata-history.md), with proof work in [EXP-005](./docs/experiments/EXP-005-event-log-and-checkpoint-replay.md) and [EXP-006](./docs/experiments/EXP-006-pretext-layout-viability.md).

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
| `DocumentFolder` | lightweight organization-only container inside a project | id, projectId, parentFolderId, title, ordering, timestamps |
| `Document` | editable prose unit kept generic in the early product | id, title, folderId, kind, contentFormat, contentJson, plainText, ordering |
| `DocumentOutlineNode` | anchored navigational marker inside one document | id, documentId, role, label, anchor, ordering |
| `Entity` | semantic definition used to detect and resolve references in text and open related context | id, name, scope, timestamps |
| `MatchingRule` | literal, alias, or pattern rule used by an entity to match text | id, entityId, ruleType, pattern, normalization |
| `TextAnchor` | durable selector payload that can re-find a document range after nearby edits | documentId, from, to, exact, prefix, suffix, blockPath, approxPlainTextOffset, versionSeen |
| `TextTransferProvenance` | future seam for copy or move operations that should preserve slice meaning across text transfers | sourceDocumentId, sourceAnchor, sliceIds, transferMode, versionSeen |
| `Slice` | reference to a bounded piece of content or a whole document | id, sourceKind, sourceId, boundaryId, label |
| `SliceBoundary` | reusable anchored range inside a document | id, documentId, anchor, timestamps |
| `EntitySlice` | many-to-many association between entities and slices | entityId, sliceId, ordering |
| `Highlight` | derived visual effect when a matching rule hits text | computed from matching results, never stored |
| `PendingEverlinkSession` | renderer-side state for one selection-driven Everlink authoring flow | sourceDocumentId, sourceSelection, selectedEntityId?, targetDocumentId?, pendingAnchor?, colorToken |
| `AnchorResolutionResult` | explicit result of trying to resolve a stored anchor against current text | state, resolvedRange?, confidence?, repairReason? |
| `ProjectNavNode` | renderer-facing union used to show folder, document, or outline navigation in one tree | nodeType, id, parentId, ordering, targetDocumentId |
| `SliceViewer` | scrollable sequence of slices for one entity | shared by modal and panel surfaces |
| `Modal` | temporary hover preview surface | shows the slice viewer and disappears on mouse exit |
| `Panel` | persistent expanded surface opened from a highlight | can host the slice viewer and a deeper document view |
| `DocumentView` | full document shown from a slice inside a panel | can show active or all slice boundaries |
| `Annotation` | low-noise personal note anchored directly to the document | id, documentId, anchor, body, style, timestamps |
| `Panel/LayoutState` | persistent workspace state | open items, pinned context, arrangement |

### History vocabulary
| Concept | Meaning now | Notes |
| --- | --- | --- |
| `EventStream` | append-only sequence of domain events for an aggregate | canonical truth for metadata history |
| `Event` | one typed semantic mutation on an aggregate | examples: `EntityRenamed`, `BoundaryMoved`, `SliceReassigned` |
| `DocumentStep` | one ProseMirror `Step` with its inverse | canonical truth for document-content history |
| `DocumentCheckpoint` | full document snapshot at a given version | stored in `document_checkpoints` as a replay base |
| `Projection` | current-state table materialized from logs and checkpoints | convenience for queries, never the truth |
| `Timeline` | unified chronological view of events and document steps | long-term writer-facing narrative of what changed when |

## Current implementation map

Where the domain concepts live in the code right now. Update this section whenever a concept moves or a new aggregate gets its own file.

| Concept | File(s) |
| --- | --- |
| Canonical domain types | [src/shared/domain/workspace.ts](src/shared/domain/workspace.ts), [src/shared/domain/document.ts](src/shared/domain/document.ts) |
| Anchor math (ProseMirror-facing) | [src/shared/anchoring.ts](src/shared/anchoring.ts) |
| IPC channel constants + `HarnessBridge` | [src/shared/contracts/harnessApi.ts](src/shared/contracts/harnessApi.ts) |
| Runtime input validation (Zod schemas) | [src/shared/contracts/harnessSchemas.ts](src/shared/contracts/harnessSchemas.ts) |
| Event type catalog | [src/db/events.ts](src/db/events.ts) |
| SQLite bootstrap + transaction API | [src/db/sqliteHarness.ts](src/db/sqliteHarness.ts) |
| Schema migrations (`user_version`-driven) | [src/db/migrations.ts](src/db/migrations.ts) |
| Row-shape decoders | [src/db/rowTypes.ts](src/db/rowTypes.ts), [src/db/rowMappers.ts](src/db/rowMappers.ts) |
| DB utility helpers | [src/db/utils.ts](src/db/utils.ts) |
| Project aggregate | [src/db/repositories/ProjectRepository.ts](src/db/repositories/ProjectRepository.ts) |
| Folder aggregate | [src/db/repositories/FolderRepository.ts](src/db/repositories/FolderRepository.ts) |
| Document aggregate | [src/db/repositories/DocumentRepository.ts](src/db/repositories/DocumentRepository.ts) |
| Entity + MatchingRule aggregate | [src/db/repositories/EntityRepository.ts](src/db/repositories/EntityRepository.ts) |
| Slice + SliceBoundary + EntitySlice | [src/db/repositories/SliceRepository.ts](src/db/repositories/SliceRepository.ts) |
| History (events, step log, checkpoints, replay) | [src/db/repositories/HistoryRepository.ts](src/db/repositories/HistoryRepository.ts) |
| Workspace layout projection | [src/db/repositories/LayoutRepository.ts](src/db/repositories/LayoutRepository.ts) |
| Composition facade + cross-aggregate transactions | [src/db/repositories/WorkspaceRepository.ts](src/db/repositories/WorkspaceRepository.ts) |
| IPC handler registration | [src/main/index.ts](src/main/index.ts) |
| Preload forwarders (context bridge) | [src/preload/index.ts](src/preload/index.ts) |
| Editor host (ProseMirror view) | [src/renderer/editor/HarnessEditor.tsx](src/renderer/editor/HarnessEditor.tsx) |
| Renderer-side anchor + match utilities | [src/renderer/editor/workbenchUtils.ts](src/renderer/editor/workbenchUtils.ts) |
| Workspace persistence coordinator | [src/renderer/state/useWorkspace.ts](src/renderer/state/useWorkspace.ts) |
| Mutation handlers hook | [src/renderer/state/useWorkspaceActions.ts](src/renderer/state/useWorkspaceActions.ts) |
| Everlink + pending-placement flow | [src/renderer/state/useEverlinkPlacement.ts](src/renderer/state/useEverlinkPlacement.ts) |
| Memoized id-indexed workspace lookups | [src/renderer/state/useWorkspaceLookups.ts](src/renderer/state/useWorkspaceLookups.ts) |
| Editor selection state | [src/renderer/state/useEditorSelections.ts](src/renderer/state/useEditorSelections.ts) |
| Short-lived UI session types (EverlinkSession, RuleFormState, HoverPreview, etc.) | [src/renderer/state/sessionTypes.ts](src/renderer/state/sessionTypes.ts) |
| Feature: project top-bar switcher | [src/renderer/features/projects/TopBar.tsx](src/renderer/features/projects/TopBar.tsx) |
| Feature: document tree + project actions | [src/renderer/features/documents/NavPanel.tsx](src/renderer/features/documents/NavPanel.tsx) |
| Feature: main editor pane | [src/renderer/features/documents/EditorPane.tsx](src/renderer/features/documents/EditorPane.tsx) |
| Feature: entity library / detail / rules | [src/renderer/features/entities/EntityList.tsx](src/renderer/features/entities/EntityList.tsx), [src/renderer/features/entities/EntityDetail.tsx](src/renderer/features/entities/EntityDetail.tsx), [src/renderer/features/entities/MatchingRuleEditor.tsx](src/renderer/features/entities/MatchingRuleEditor.tsx) |
| Feature: Everlink chooser UI | [src/renderer/features/entities/EverlinkPanel.tsx](src/renderer/features/entities/EverlinkPanel.tsx) |
| Feature: pending slice placement panel | [src/renderer/features/panes/SlicePlacementPanel.tsx](src/renderer/features/panes/SlicePlacementPanel.tsx) |
| Feature: slice viewer, panel-document view, hover preview | [src/renderer/features/panes/SliceViewer.tsx](src/renderer/features/panes/SliceViewer.tsx), [src/renderer/features/panes/PanelDocumentView.tsx](src/renderer/features/panes/PanelDocumentView.tsx), [src/renderer/features/panes/HoverPreview.tsx](src/renderer/features/panes/HoverPreview.tsx) |
| Feature: run log | [src/renderer/features/history/RunLog.tsx](src/renderer/features/history/RunLog.tsx) |
| App shell (composition only) | [src/renderer/App.tsx](src/renderer/App.tsx) |
| Tests | [src/shared/anchoring.test.ts](src/shared/anchoring.test.ts), [src/db/repositories/WorkspaceRepository.test.ts](src/db/repositories/WorkspaceRepository.test.ts) |

## Data and storage stance
SQLite is the canonical runtime store.
The current best-fit project shape is a local project directory that contains at least:

- a SQLite database for structured project data, append-only event and step logs, and document checkpoints
- optional adjacent asset or export material
- a first-class export path so the author is never trapped in an opaque container, and that path carries history

The database owns a **log-first model** for working truth. Every mutation is appended to the domain event log or the ProseMirror step log, or both, before projections are updated. MVP history writes are append-then-project inside one SQLite transaction. Current-state tables for document folders, documents, entities, matching rules, entity-slice links, slices, slice boundaries, annotations, and layout state are **projections** of those logs plus document checkpoints, and they must be rebuildable from scratch.

Document rows keep the shape established by ADR-003, plus the lightweight organization metadata the writing workspace needs:

- `folderId` links a document into the project tree
- `ordering` is stable within its folder
- `kind` stays generic in the first build and must not quietly become a behavior switch
- `contentFormat` identifies the editor schema family
- `contentSchemaVersion` identifies the stored snapshot version
- `contentJson` stores the canonical structured document snapshot
- `plainText` stores the denormalized text projection used by matching, search, export, and other non-editor helpers

The `documents` row is the head current-state projection for a document. Historical replay bases live in `document_checkpoints`. Opening a document at any version uses the nearest checkpoint plus forward `Step` replay.
`DocumentFolder` records define a lightweight tree for project organization; the renderer can expose that tree as a `ProjectNavNode` union without mirroring filesystem folders. `DocumentOutlineNode` records land later as anchored metadata inside a document and should reuse `TextAnchor` rather than inventing a second navigation-position system.

Highlights stay derived from document text plus matching results rather than becoming stored records.
Matches never become stored or precomputed document records.
Slice boundaries stay reusable records rather than being hidden inside slice blobs.
Slice boundaries and annotations share the same `TextAnchor` payload shape even if they live in different tables.
Slice boundaries persist one range anchor each. Truth does not get split into separate line-number start and end markers.
Regex belongs to entity matching. Slice repair and preview resolution should use exact text plus context, with fail-closed ambiguity handling rather than raw regex replay.

Every semantic anchor mutation records the anchor payload together with `documentVersionSeen`. Historical reconstruction starts from the latest anchor event at or before the target version, then maps forward through document steps. If mapping collapses or deletes the range, the current anchor state becomes invalid rather than being silently healed.

Portability is not optional, so export and package behavior must carry logs and checkpoints, not just the current projection.
Editor-only decorations must never pollute clipboard output or plain-text export. A full-document copy should yield clean prose, not entity markup, slice chrome, or annotation affordances.
Future slice-aware text transfer can hang off `TextTransferProvenance`, but the normal document snapshot model must not depend on that future feature before it exists.

## Editor strategy
- Use ProseMirror as the editor foundation. Do not treat this as provisional.
- Keep semantic behavior composable: matching, derived highlighting, modal preview, panel open, document view, boundary editing, and annotation rendering stay separable concerns.
- Treat ProseMirror's `Decoration` API as the home for derived highlights and quiet annotation underlines; neither is persisted inside the document.
- Treat ProseMirror's `Step` and `Mapping` as the document-content primitives for both live anchor migration and the history layer.
- Let editor selection affordances bootstrap entity-and-slice authoring through `Everlink it!` without storing hyperlink markup in the manuscript.
- Keep target-document placement and pending-slice editing inside persistent panel document view rather than hover modals.
- Let slice boundaries and annotations share one anchor-healing substrate.
- Let future outline navigation reuse that same anchor substrate rather than inventing a separate heading-position model.
- Live-calculate matches from visible text when highlighting is enabled rather than precomputing whole-document match sets.
- Allow authors to disable live matching and highlighting while writing.
- Explore Pretext before locking the long-document layout and visible-range mapping design, especially for document view or virtualized reading surfaces.
- Avoid pushing database or IPC details into editor plugins.
- Keep editor decorations and chrome out of the clipboard path so `Ctrl+A` and `Ctrl+C` remain trustworthy.
- Prefer a renderer shell where the editor receives domain results and renders them, rather than embedding persistence logic inside editor code.
- Modal and panel are different views over the same slice-viewer data rather than separate product models.
- The editor is the source of truth for emitting `DocumentStep` records into the step log, but it does not own how they are persisted.

## Key technical tradeoffs
- SQLite-first storage simplifies querying and consistency, but raises the bar for transparent export, and export must include logs and checkpoints rather than just current state.
- A single-app repo is simpler now, but shared code must stay clean enough that extraction would still be possible later.
- ProseMirror asks for more upfront schema and plugin discipline, but its transaction mapping, decoration model, and `Step` primitive line up directly with Evernear's anchored-range problems.
- Full snapshot persistence remains simpler and safer than pure delta-stream storage for current state, and the history layer reuses those snapshots as checkpoints rather than competing with them.
- A lightweight tree of folders plus generic documents keeps organization useful without pretending to be binder software, but it also means semantic meaning must stay clearly separate from navigation structure.
- Live visible-range matching keeps the product honest to the desired interaction model, but it makes layout and invalidation strategy as important as raw regex throughput.
- Persistent panels are part of the core product loop, so layout state belongs in the early architecture even if advanced windowing does not.
- Event sourcing makes history honest and projections rebuildable, but every mutation path must write log and projection atomically, and projection rebuild logic must be maintained.

## Future considerations
- The exact acceptance thresholds for anchor healing under live edits.
- Matching normalization rules, visible-range invalidation, and author-controlled highlight toggles.
- How internal outline nodes are authored, displayed, and reordered once anchored document navigation lands.
- How `All Slices` mode, overlap visualization, and boundary merge or link should behave.
- How `TextTransferProvenance` should serialize once slice-aware copy or move is implemented.
- Whether project export should be plain-text-first, bundle-first, or dual-mode, and how logs and checkpoints serialize in each.
- The shape of the writer-facing timeline UI once the restore-first MVP surface is proven.
- Checkpoint cadence beyond every explicit save, and whether writers can name checkpoints directly.
- Whether Pretext materially improves long-document layout and viewport tracking enough to change the current rendering approach.

## Decided
- Single desktop app repo with clear source boundaries.
- Narrow preload API and limited IPC surface.
- SQLite-first project storage with a mandatory ownership and export story that includes history.
- React renderer and ProseMirror editor foundation.
- The first organization model is a lightweight tree of folders plus generic documents.
- Documents persist as full JSON snapshots plus a plain-text projection.
- Organization is orthogonal to entity semantics.
- Document outline nodes are anchored navigation metadata later, not separate documents and not an early document taxonomy.
- The `documents` row is current state; `document_checkpoints` stores historical replay bases.
- Entities are semantic definitions, not visual objects.
- Matches are live-calculated and never stored or precomputed as document truth.
- Highlights are derived, not stored.
- Clean copy out must not leak decorations or editor chrome.
- History is event-sourced. The domain event log and the ProseMirror step log are canonical; current-state tables are projections.
- MVP history writes append then project inline inside one SQLite transaction.
- The first writer-visible history surface can be a minimal restore-previous-version action after the truthful MVP.
- Branching as a product feature, merge, conflict resolution, and collaboration are out of scope.

## Open
- Exact project folder and package format, and how logs plus checkpoints serialize on export.
- Exact first tree interaction model for folders, documents, and later outline nodes.
- Exact state-management approach inside the renderer.
- Exact migration tooling and schema evolution conventions, including event payload versioning.
- Exact `TextAnchor` representation in ProseMirror position space under unusual edits.
- Exact repair ranking and UI behavior when `AnchorResolutionResult` is `ambiguous` or `invalid`.
- Exact `TextTransferProvenance` payload shape once slice-aware transfer lands.
- Whether to use TipTap or raw ProseMirror at the React seam.
- Checkpoint cadence and named-checkpoint UX.
- Exact annotation-style preference surface for authors.
- Whether Pretext belongs only in document view or changes the primary long-document rendering strategy.

## Deferred
- Binder-style manuscript tooling beyond the lightweight tree the first workflow needs.
- Multi-window sophistication beyond what the core workflow requires.
- Search and analytics features beyond immediate re-entry value.
- Graph-style relationship visualization beyond what the core workflow requires.
- Slice-preserving `Move Slice` behavior until anchor, provenance, and history rules are proven.
- A full scrubbable timeline UI beyond the initial restore-first surface.
- Visible branching UX.
- Any collaboration, CRDT, or merge functionality.
