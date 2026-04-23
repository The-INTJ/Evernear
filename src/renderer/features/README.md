# Renderer Features

## Status
MVP now

## If you landed here first
Read [src/renderer/README.md](../README.md) first. This folder groups user-facing capability areas without pretending each one is already a separate package.

## Parent reads
- [src/renderer/README.md](../README.md)
- [FOR_HUMAN_CODE--DOC.md](../../../FOR_HUMAN_CODE--DOC.md)
- [FOR_HUMAN_BUSINESS--DOC.md](../../../FOR_HUMAN_BUSINESS--DOC.md)

## Owns
- Product-facing workflows organized by capability.
- The boundary between app shell concerns and feature concerns in the renderer.

## Does not own
- Cross-runtime contract definitions.
- Database implementation details.
- Global Electron lifecycle policy.

## Key relationships
- `projects`: opening and managing a project in the UI.
- `documents`: listing, opening, and organizing writing material; includes the main editor pane.
- `entities`: creating and using semantic context, including the Everlink chooser.
- `panes`: persistent panel, slice-viewer, document-view, hover preview, and pending slice placement.
- `annotations`: low-noise note capture built on the same anchor substrate as slice boundaries.
- `chrome`: app-level chrome and status surfaces that don't belong to any single feature.
- `history`: workspace-level run log and history-surface components.
- `help`: in-app shortcut and workflow guidance opened from the custom chrome.

## Decided
- Feature folders exist to make the product shape readable early, not to force premature micro-architecture.

## Open
- Whether any of these areas should later merge or split based on actual code pressure.

## Deferred
- A plugin-like internal feature system.
