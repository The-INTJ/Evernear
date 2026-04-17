# Database Schema

## Status
MVP now

## If you landed here first
Read [src/db/README.md](../README.md) first, then [src/shared/domain/README.md](../../shared/domain/README.md). Schema should follow the domain model, not invent it.

## Parent reads
- [src/db/README.md](../README.md)
- [FOR_HUMAN_CODE--DOC.md](../../../FOR_HUMAN_CODE--DOC.md)
- [src/shared/domain/README.md](../../shared/domain/README.md)

## Owns
- Table families and migration direction.
- How domain concepts map into SQLite.

## Does not own
- Query orchestration details.
- UI state beyond persisted layout and workspace data.
- Domain naming.

## Likely table families
| Area | Likely tables | Notes |
| --- | --- | --- |
| project | `project_meta`, `project_preferences` | small, stable metadata |
| documents | `documents` | exact content storage shape still open |
| entities | `entities`, `alias_rules`, `entity_targets` | core semantic model |
| slices | `slices` | anchor strategy still open |
| annotations | `annotations` | lower urgency than entities |
| categories | `semantic_categories` | supports overlays and filtering |
| workspace | `pane_layouts`, `workspace_state` | local persistence for flow |

## Key relationships
- Schema decisions should preserve clean repository boundaries.
- Tables should support the honest core workflow before chasing secondary analytics.

## Decided
- The schema will track product concepts directly enough that the app remains understandable.

## Open
- Exact document content representation.
- Exact slice anchor columns and update strategy.
- Exact foreign-key and cascade policy.

## Deferred
- Search indexes and advanced derived tables until the central loop proves itself.
