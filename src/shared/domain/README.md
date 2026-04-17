# Shared Domain

## Status
MVP now

## If you landed here first
Read [FOR_HUMAN_CODE--DOC.md](../../../FOR_HUMAN_CODE--DOC.md) first. This folder is the canonical vocabulary for the app, so upstream context matters.

## Parent reads
- [src/shared/README.md](../README.md)
- [FOR_HUMAN_CODE--DOC.md](../../../FOR_HUMAN_CODE--DOC.md)
- [FOR_HUMAN_BUSINESS--DOC.md](../../../FOR_HUMAN_BUSINESS--DOC.md)

## Owns
- The stable names and meanings of core concepts.
- Shared type surfaces that should remain readable across runtimes.

## Does not own
- SQL schema details.
- UI interaction policy.
- Electron-specific code.

## Canonical concepts
| Concept | Why it exists | Notes |
| --- | --- | --- |
| `Project` | groups one story workspace | local-first, single-user-first |
| `Document` | holds editable narrative or reference content | story, lore, notes, reference all fit here |
| `Entity` | defines semantic meaning that can be detected in text | owns matching rules and slice associations; it is not visual |
| `MatchingRule` | describes how text maps to an entity | can be literal, alias-based, or pattern-based |
| `TextAnchor` | gives the app a durable way to find a range again after edits | shared substrate for slice boundaries and annotations |
| `Slice` | references a bounded relevant region, whole document, or later another asset | does not own content |
| `SliceBoundary` | captures a reusable anchored range inside a document | multiple slices may share one boundary |
| `Annotation` | captures low-noise personal notes | direct document anchors, not collaborative review comments |
| `Highlight` | provides the visual effect of a match in text | derived, never stored |
| `SliceViewer` | shows the slices associated with an entity | shared by modal and panel surfaces |
| `Modal` | handles temporary hover preview | disappears on mouse exit |
| `Panel` | handles persistent expanded context | can open a deeper document view |
| `DocumentView` | shows a full document from a slice within a panel | boundary-aware editing and navigation live here |
| `Panel/LayoutState` | remembers how context stays visible | supports re-entry and flow |

## Key relationships
- `db/schema` should map to these concepts without distorting the many-to-many `Entity` to `Slice` relationship.
- `SliceBoundary` and `Annotation` should share the same `TextAnchor` payload shape even if they persist in different tables.
- `renderer/features` should consume these names directly rather than invent local synonyms.

## Decided
- These names are the shared vocabulary to build around unless a stronger term emerges.

## Open
- Exact document-kind taxonomy.
- Exact matching-rule richness in the first implementation.

## Deferred
- Graph-style relationship modeling beyond the slices needed for the core workflow.
