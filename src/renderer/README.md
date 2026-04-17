# Renderer

## Status
MVP now

## If you landed here first
Read [src/README.md](../README.md), then [FOR_HUMAN_CODE--DOC.md](../../FOR_HUMAN_CODE--DOC.md). If you care about product flow more than folder shape, also read [FLOW.md](./FLOW.md).

## Parent reads
- [src/README.md](../README.md)
- [FOR_HUMAN_CODE--DOC.md](../../FOR_HUMAN_CODE--DOC.md)
- [FOR_HUMAN_BUSINESS--DOC.md](../../FOR_HUMAN_BUSINESS--DOC.md)

## Owns
- React app shell.
- Pane orchestration and workspace state at the UI layer.
- Editor hosting and feature composition.
- User-facing interaction flow.

## Does not own
- Raw SQL or schema details.
- Broad privileged access.
- Cross-runtime contract definitions.

## Inputs and outputs
- Inputs: typed bridge calls, domain DTOs, persisted workspace state.
- Outputs: user interactions, feature requests, pane/layout updates, edit intents.

## Key relationships
- Uses `editor` for the writing surface.
- Uses `features/*` for product-facing workflows.
- Relies on `shared/domain` and `shared/contracts` instead of inventing local terms.

## Likely future code here
- `app-shell`
- `workspace`
- `routes` or `screens` if needed
- composition around editor and feature areas

## Decided
- The renderer should stay UI-focused.
- Side panes are part of the honest core workflow, not an optional flourish.

## Open
- Exact renderer state-management approach.
- Whether document navigation needs lightweight routing or can stay shell-local for a while.

## Deferred
- Detached windows and multi-monitor sophistication beyond what proves the core product loop.
