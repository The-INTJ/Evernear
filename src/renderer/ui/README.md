# Renderer UI

## Status
MVP now

## If you landed here first
Read [../README.md](../README.md), then [../styles/README.md](../styles/README.md). This folder holds small renderer-only primitives that keep repeated visual controls out of feature components.

## Parent reads
- [../README.md](../README.md)
- [../styles/README.md](../styles/README.md)

## Owns
- Reusable buttons, inputs, selects, panels, cards, menus, and modal shells.
- CSS Module styles for those primitives.

## Does not own
- Feature-specific content or workflow decisions.
- Domain terms or persistence behavior.
- ProseMirror editor decoration classes.

## Key relationships
- Feature components import these primitives instead of sharing global utility class names.
- Primitive styles consume custom properties from `src/renderer/styles/tokens.css`.

## Decided
- Keep primitives thin and boring: no hidden state, no domain behavior, no variant expansion before a feature actually needs it.
- Prefer composition over a large design-system abstraction.

## Open
- Whether icon-only button variants should land with the design review.

## Deferred
- Form validation components and theme switching controls.
