# Preload Bridge

## Status
MVP now

## If you landed here first
Read [src/README.md](../README.md) for the runtime map, then [FOR_HUMAN_CODE--DOC.md](../../FOR_HUMAN_CODE--DOC.md) for the security and boundary stance.

## Parent reads
- [src/README.md](../README.md)
- [FOR_HUMAN_CODE--DOC.md](../../FOR_HUMAN_CODE--DOC.md)
- [ADR-001](../../docs/adr/ADR-001-stack-and-shell-baseline.md)

## Owns
- The smallest useful renderer-facing API.
- Validation and translation between IPC payloads and renderer callers.
- Least-privilege exposure of privileged capabilities.

## Does not own
- Product workflow rules.
- Database policy.
- React state or UI composition.

## Inputs and outputs
- Inputs: typed IPC calls from the renderer, responses from main.
- Outputs: a stable `window` API or equivalent bridge surface for the renderer.

## Key relationships
- Mirrors contracts from `src/shared/contracts`.
- Proxies approved calls to `src/main`.
- Should remain boring on purpose.

## Likely future code here
- `bridge`
- `validators`
- `exposed-api`

## Decided
- The preload API should stay narrow and typed.
- The renderer should never receive broad filesystem or database access.

## Open
- How much runtime validation should live here versus deeper in the app boundary.

## Deferred
- Convenience APIs that only save a few lines in the renderer.
