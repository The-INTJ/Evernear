# Glossary

## Status
MVP now

## If you landed here first
Read [FOR_HUMAN_BUSINESS--DOC.md](../../FOR_HUMAN_BUSINESS--DOC.md) and [FOR_HUMAN_CODE--DOC.md](../../FOR_HUMAN_CODE--DOC.md) first. This file is the canonical language for how Evernear talks about the product model and its core UI surfaces.

## Parent reads
- [FOR_HUMAN_BUSINESS--DOC.md](../../FOR_HUMAN_BUSINESS--DOC.md)
- [FOR_HUMAN_CODE--DOC.md](../../FOR_HUMAN_CODE--DOC.md)

## Organization terms
| Term | Meaning | Notes |
| --- | --- | --- |
| `Project` | one local writing workspace | contains organization, prose, entities, and history |
| `DocumentFolder` | lightweight container that organizes documents in a project tree | organization-only, not a semantic category |
| `Document` | editable prose unit | stays generic early rather than splitting into behavior-heavy kinds |
| `DocumentOutlineNode` | anchored navigational marker inside a document | can later represent `book`, `part`, `chapter`, `section`, or custom stops |
| `ProjectNavNode` | renderer-facing tree item for folder, document, or outline navigation | derived from stored records rather than stored separately |

## Core terms
| Term | Meaning | Notes |
| --- | --- | --- |
| `Entity` | first-class semantic definition used to detect and resolve references in text | owns a list of matching rules and a slice library; it is not visual |
| `MatchingRule` | one item in an entity's match list | may be literal, alias-based, or pattern-based |
| `TextAnchor` | durable selector payload for a range inside a document | shared substrate for slice boundaries and annotations; stores exact text, local context, and optional coarse jump hints rather than line-number truth |
| `TextTransferProvenance` | future payload for copy or move operations that should preserve slice meaning | not required for ordinary clipboard use |
| `Slice` | reference to a bounded piece of content | can point to part of a document, a whole document, or later a non-text asset |
| `SliceBoundary` | reusable anchored range inside a document | multiple slices may share one boundary |
| `Annotation` | low-noise personal note anchored directly to the main document | conceptually a direct anchored span, not a collaborative comment thread |
| `Highlight` | derived visual effect produced when a matching rule hits text | computed, never stored |
| `PendingEverlinkSession` | temporary authoring state that carries a selection-driven Everlink flow | holds source selection, chosen entity, target document, pending range, and temporary visual styling |
| `AnchorResolutionResult` | explicit outcome of trying to resolve a stored anchor against current text | should fail closed as `ambiguous` or `invalid` rather than jump to the wrong place |

## UI surfaces
| Term | Meaning | Notes |
| --- | --- | --- |
| `SliceViewer` | scrollable sequence of slices associated with an entity | reused in both hover and persistent views |
| `Modal` | temporary hover preview surface | shows the slice viewer and disappears on mouse exit |
| `Panel` | persistent expanded surface opened from a highlight | contains the slice viewer and deeper navigation |
| `DocumentView` | full document opened from a slice inside a panel | shows the active slice boundary and may show all slice boundaries |
| `Everlink it!` | selection-driven authoring entry point for creating or extending an entity and placing a related slice | bootstraps semantic truth from a selection without storing manuscript hyperlink markup |

## Boundary language
| Term | Meaning | Notes |
| --- | --- | --- |
| `AnchorHealing` | process that maps or re-resolves a `TextAnchor` after edits | mapping first, then exact-text plus context repair if needed |
| `VerticalBoundaries` | subtle left/right indicators for a slice's horizontal extent | persist while viewing a slice |
| `HorizontalBoundaries` | prominent top/bottom indicators for slice start and end | define exact slice limits |
| `BoundaryEditing` | changing a slice boundary by dragging handles or typing within the slice | edits inside bounds auto-expand the boundary |
| `AllSlicesToggle` | mode that reveals every slice boundary in the current document | supports overlap inspection and alignment work |
| `SliceOverlap` | overlapping slice regions in one document | visualized with multiple boundary sets |
| `BoundaryMergeOrLink` | operation that makes multiple slices share one boundary | future edits then affect all linked slices |

## Future-facing terms
| Term | Meaning | Notes |
| --- | --- | --- |
| `EntityExplorer` | management UI for entities and their slices | supports grouping, inspection, and editing |
| `Graph` | future visualization of relationships between entities | not required for MVP |

## Key principles
- Organization is orthogonal to entity semantics.
- Entities define meaning, not visuals.
- Matches are live-derived, never precomputed as stored document truth.
- Regex belongs to matching rules, not slice repair.
- Slices define context, not ownership.
- Boundaries are reusable, not implicit.
- Slice boundaries and annotations share the same anchor substrate.
- Outline nodes should reuse that anchor substrate when they land.
- Highlights are derived, never stored.
- Copying text out should not leak editor-only artifacts.
- Modal and panel are different views over the same underlying data.
