# Database Schema

## Status
MVP now

## If you landed here first
Read [src/db/README.md](../README.md) first, then [src/shared/domain/README.md](../../shared/domain/README.md). Schema should follow the domain model, not invent it.

## Parent reads
- [src/db/README.md](../README.md)
- [FOR_HUMAN_CODE--DOC.md](../../../FOR_HUMAN_CODE--DOC.md)
- [src/shared/domain/README.md](../../shared/domain/README.md)
- [ADR-006](../../../docs/adr/ADR-006-event-sourced-document-and-metadata-history.md)

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
| documents | `documents`, `document_checkpoints`, `document_steps` | `documents` is current state; checkpoints and steps drive replay |
| entities | `entities`, `matching_rules`, `entity_slices` | core semantic model plus many-to-many slice links |
| slices | `slices`, `slice_boundaries` | slice references plus reusable anchored bounds |
| annotations | `annotations` | same anchor payload shape as `slice_boundaries`, quieter UI meaning |
| history | `events` | typed semantic history for aggregates |
| workspace | `panel_layouts`, `workspace_state` | local persistence for flow |

Highlights are derived from matching results and should not become their own stored table family.

## Key relationships
- Schema decisions should preserve clean repository boundaries.
- Tables should support the honest core workflow before chasing secondary analytics.
- MVP history schema stays minimal: no branch columns, parent pointers, or alternate-stream metadata until a real branching feature exists.

## Decided
- The schema will track product concepts directly enough that the app remains understandable.
- `document_checkpoints` stores replay bases while `documents` stays the head current-state projection.

## Open
- Exact anchor payload column split and whether any selector fields should be broken out for indexing.
- Exact foreign-key and cascade policy.

## Deferred
- Search indexes and advanced derived tables until the central loop proves itself.
