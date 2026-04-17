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
| `Entity` | represents a meaningful in-world thing or concept | not just a hyperlink |
| `AliasRule` | describes how text maps to an entity | literal first, broader patterns later |
| `EntityTarget` | tells the app where the entity points | document or slice first |
| `Slice` | identifies a bounded relevant region inside a document | key differentiator, harder than it looks |
| `Annotation` | captures low-noise personal notes | not collaborative review comments |
| `SemanticCategory` | groups meaning for color and filter behavior | powers overlays and legend behavior |
| `ViewMode` | captures interaction depth | hover, pane, focused |
| `Pane/LayoutState` | remembers how context stays visible | supports re-entry and flow |

## Key relationships
- `db/schema` should map to these concepts without distorting them.
- `renderer/features` should consume these names directly rather than invent local synonyms.

## Decided
- These names are the shared vocabulary to build around unless a stronger term emerges.

## Open
- Exact document-kind taxonomy.
- Exact alias-rule richness in the first implementation.

## Deferred
- More exotic target types beyond documents and slices.
