# ADR-001: Stack and Shell Baseline

## Status
Accepted

## Date
2026-04-17

## Parent reads
- [FOR_HUMAN_CODE--DOC.md](../../FOR_HUMAN_CODE--DOC.md)
- [FOR_HUMAN_BUSINESS--DOC.md](../../FOR_HUMAN_BUSINESS--DOC.md)
- [FOR_HUMAN_AND_AI_ROADMAP--DOC.md](../../FOR_HUMAN_AND_AI_ROADMAP--DOC.md)

## Context
Evernear is a desktop-first, local-first writing product whose differentiator is semantic context and multi-panel re-entry flow, not cloud collaboration.
The project needs a stack that is practical to build, supports strong local workflows, and gives the editor enough room for custom behavior without turning the shell into the main challenge.
The editor recommendation also has to respect the load-bearing reality that Evernear is really about anchored ranges, derived decorations, and document-adjacent context, not generic rich text.

## Decision
Use:

- Electron for the desktop shell
- React and TypeScript for the renderer
- Vite for development and build tooling
- ProseMirror as the editor foundation (locked in by [ADR-005](./ADR-005-editor-foundation-locked-to-prosemirror.md))
- SQLite for local project storage

Keep the repo as a single desktop app with strong internal boundaries instead of starting with a package workspace.

## Consequences
- The stack is familiar and buildable now.
- Runtime boundaries are explicit: `main`, `preload`, `renderer`, `shared`, `db`.
- We accept Electron overhead in exchange for speed of execution and ecosystem support.
- We accept ProseMirror's extra upfront schema and plugin ceremony because transaction mapping and decorations better match Evernear's anchored-range problems.
- We avoid early package extraction until the codebase creates real pressure for it.

## Decided
- This is the working baseline for implementation planning.

## Open
- Exact state-management and migration-tool choices within the baseline.

## Deferred
- Alternative shells or editor foundations unless the chosen stack proves inadequate.
