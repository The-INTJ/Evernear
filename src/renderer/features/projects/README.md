# Project Features

## Status
MVP now

## If you landed here first
Read [src/renderer/features/README.md](../README.md), then [src/main/README.md](../../../main/README.md). Project UX touches both renderer and main boundaries.

## Parent reads
- [src/renderer/features/README.md](../README.md)
- [src/renderer/README.md](../../README.md)
- [FOR_HUMAN_CODE--DOC.md](../../../../FOR_HUMAN_CODE--DOC.md)

## Owns
- Project picker and project-open UI.
- Recent project affordances if they appear.
- Renderer-side state around the active project session.

## Does not own
- Database bootstrap internals.
- Raw filesystem dialogs or privileged file access.
- Document editing rules.

## Inputs and outputs
- Inputs: project metadata, open/close intents, session restore info.
- Outputs: active-project state, open-project requests, recent-project display state.

## Key relationships
- Delegates privileged open operations to `main` through the preload bridge.
- Feeds project context into documents, entities, panes, and annotations.

## Likely future code here
- `project-picker`
- `recent-projects`
- `active-project-context`

## Decided
- The project boundary should be explicit in the UI, not hidden as a background implementation detail.

## Open
- Whether the first version needs recent-project UX or only explicit open/create.

## Deferred
- Multi-project workspaces.
