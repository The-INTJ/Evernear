# Renderer Styles

## Status
MVP now

## If you landed here first
Read [../README.md](../README.md), then [../../README.md](../../README.md). Global styles here are for app-wide foundations only; component styles belong beside the component as CSS Modules.

## Parent reads
- [../README.md](../README.md)
- [../../../FOR_HUMAN_CODE--DOC.md](../../../FOR_HUMAN_CODE--DOC.md)

## Owns
- Design tokens and theme aliases.
- Browser reset and base renderer behavior.
- Top-level app layout classes.
- ProseMirror/editor decoration classes that are emitted outside React CSS Modules.

## Does not own
- Feature-specific visual layout.
- Component button, input, card, menu, or modal styling.
- Product workflow state.

## Key relationships
- `index.css` is the only global stylesheet imported by the renderer entrypoint.
- `tokens.css` is the design-review seam; visual changes should start there before touching feature modules.
- CSS Modules in `features/*` and `ui/*` consume these custom properties.

## Decided
- Plain CSS and CSS Modules are the default styling path.
- SCSS is deferred until the codebase earns preprocessor features.
- ProseMirror decoration classes stay global because they are applied by editor plugins and DOM widgets, not by React components.

## Open
- Whether a later design system pass should add lint rules for raw colors and spacing.

## Deferred
- Theme switching and author-configurable annotation visuals.
