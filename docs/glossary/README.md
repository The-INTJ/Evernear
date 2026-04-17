# Glossary

## Status
MVP now

## If you landed here first
Read [FOR_HUMAN_BUSINESS--DOC.md](../../FOR_HUMAN_BUSINESS--DOC.md) and [FOR_HUMAN_CODE--DOC.md](../../FOR_HUMAN_CODE--DOC.md) first. This file is the canonical language for how Evernear talks about the product model and its core UI surfaces.

## Parent reads
- [FOR_HUMAN_BUSINESS--DOC.md](../../FOR_HUMAN_BUSINESS--DOC.md)
- [FOR_HUMAN_CODE--DOC.md](../../FOR_HUMAN_CODE--DOC.md)

## Core terms
| Term | Meaning | Notes |
| --- | --- | --- |
| `Entity` | first-class semantic definition used to detect and resolve references in text | owns matching rules and slice associations; it is not visual |
| `MatchingRule` | the rule an entity uses to match text | may be literal, alias-based, or pattern-based |
| `Slice` | reference to a bounded piece of content | can point to part of a document, a whole document, or later a non-text asset |
| `SliceBoundary` | reusable start/end definition inside a document | multiple slices may share one boundary |
| `Highlight` | derived visual effect produced when a matching rule hits text | computed, never stored |

## UI surfaces
| Term | Meaning | Notes |
| --- | --- | --- |
| `SliceViewer` | scrollable sequence of slices associated with an entity | reused in both hover and persistent views |
| `Modal` | temporary hover preview surface | shows the slice viewer and disappears on mouse exit |
| `Panel` | persistent expanded surface opened from a highlight | contains the slice viewer and deeper navigation |
| `DocumentView` | full document opened from a slice inside a panel | shows the active slice boundary and may show all slice boundaries |

## Boundary language
| Term | Meaning | Notes |
| --- | --- | --- |
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
- Entities define meaning, not visuals.
- Slices define context, not ownership.
- Boundaries are reusable, not implicit.
- Highlights are derived, never stored.
- Modal and panel are different views over the same underlying data.
