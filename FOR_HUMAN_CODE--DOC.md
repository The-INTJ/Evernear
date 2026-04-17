# FOR_HUMAN_CODE--DOC

## Last change
2026-04-17: aligned the canonical model around entities, matching rules, slices, reusable slice boundaries, and derived highlights.

## Current recommendation
Build Evernear as a single desktop app repo with strong source boundaries:

- `src/main`: Electron app lifecycle, project open/load, window creation, IPC registration
- `src/preload`: the narrow bridge between privileged code and the renderer
- `src/renderer`: React UI, panel orchestration, and feature composition
- `src/shared`: canonical domain language and cross-runtime contracts
- `src/db`: SQLite schema direction, repositories, migrations, and export logic

This keeps the repo approachable while still giving us clear seams for future extraction if the codebase earns it.

## Stack baseline
- Electron: practical desktop shell with familiar tooling and good AI/codegen support
- React + TypeScript + Vite: fast iteration, readable component model, clear type surfaces
- Lexical: structured editor foundation with room for semantic decoration and custom behavior
- SQLite: local-first storage with transactional reads/writes and rich querying for entity-aware workflows

We are treating this as the working baseline, not a provisional brainstorming list.

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
| `Document` | editable story/lore/reference unit | id, title, kind, content, ordering |
| `Entity` | semantic definition used to detect and resolve references in text | id, name, scope, timestamps |
| `MatchingRule` | literal, alias, or pattern rule used by an entity to match text | id, entityId, ruleType, pattern, normalization |
| `Slice` | reference to a bounded piece of content or a whole document | id, sourceKind, sourceId, boundaryId, label |
| `SliceBoundary` | reusable start/end definition inside a document | id, documentId, start, end, timestamps |
| `EntitySlice` | many-to-many association between entities and slices | entityId, sliceId, ordering |
| `Highlight` | derived visual effect when a matching rule hits text | computed from matching results, never stored |
| `SliceViewer` | scrollable sequence of slices for one entity | shared by modal and panel surfaces |
| `Modal` | temporary hover preview surface | shows the slice viewer and disappears on mouse exit |
| `Panel` | persistent expanded surface opened from a highlight | can host the slice viewer and a deeper document view |
| `DocumentView` | full document shown from a slice inside a panel | can show active or all slice boundaries |
| `Annotation` | low-noise personal note | id, documentId, anchor, body, timestamps |
| `Panel/LayoutState` | persistent workspace state | open items, pinned context, arrangement |

## Data and storage stance
SQLite is the canonical runtime store.
The current best-fit project shape is a local project directory that contains at least:

- a SQLite database for structured project data
- optional adjacent asset/export material
- a first-class export path so the author is never trapped in an opaque container

The database should own the working truth for documents, entities, matching rules, entity-slice links, slices, slice boundaries, annotations, and layout state.
Highlights should stay derived from document text plus matching results rather than becoming stored records.
Slice boundaries should be reusable records rather than hidden inside slice blobs.
Portability is not optional, so export/package support must be treated as a core system concern rather than a late utility.

## Editor strategy
- Use Lexical as the editor host, not as the source of product architecture.
- Keep semantic behavior composable: matching, derived highlighting, modal preview, panel open, document view, and boundary editing should be separable concerns.
- Avoid pushing heavy domain or persistence logic into editor plugins.
- Prefer a renderer shell where the editor asks for domain results and renders them, rather than embedding database or IPC details directly into editor code.
- Modal and panel should be different views over the same slice-viewer data rather than separate product models.

## Key technical tradeoffs
- SQLite-first storage simplifies querying and consistency, but raises the bar for transparent export.
- A single-app repo is simpler now, but shared code must stay clean enough that we could extract packages later if useful.
- Lexical gives us strong extension points, but we should prove the central workflow before inventing too many custom node types.
- Persistent panels are part of the core product loop, so layout state belongs in the early architecture even if advanced windowing does not.
- Reusable slice boundaries make the model more truthful, but they raise the bar for edit tracking and boundary-link behavior.

## Future considerations
- Exact slice-boundary anchoring strategy under document edits.
- Matching normalization rules and performance boundaries for entity detection.
- How `All Slices` mode, overlap visualization, and boundary merge/link should behave.
- Whether project export should be plain-text-first, bundle-first, or dual-mode.

## Decided
- Single desktop app repo with clear source boundaries.
- Narrow preload API and limited IPC surface.
- SQLite-first project storage with a mandatory ownership/export story.
- React renderer and Lexical editor host.
- Entities are semantic definitions, not visual objects.
- Highlights are derived, not stored.

## Open
- Exact project folder/package format.
- Exact state-management approach inside the renderer.
- Exact migration tooling and schema evolution conventions.
- Exact slice-boundary anchoring model.

## Deferred
- Multi-window sophistication beyond what the core workflow requires.
- Search/analytics features beyond immediate re-entry value.
- Graph-style relationship visualization beyond what the core workflow requires.
