# Shared

## Status
MVP now

## If you landed here first
Read [src/README.md](../README.md) and [FOR_HUMAN_CODE--DOC.md](../../FOR_HUMAN_CODE--DOC.md). This folder exists to stop each runtime from inventing its own language for the same concepts.

## Parent reads
- [src/README.md](../README.md)
- [FOR_HUMAN_CODE--DOC.md](../../FOR_HUMAN_CODE--DOC.md)
- [FOR_HUMAN_BUSINESS--DOC.md](../../FOR_HUMAN_BUSINESS--DOC.md)

## Owns
- Canonical domain vocabulary.
- Cross-runtime contracts and DTO shapes.
- Shared validation or normalization rules where they truly belong.

## Does not own
- Renderer-specific UI state.
- Main-process lifecycle logic.
- Direct database implementation.

## Key relationships
- `domain` defines what the product concepts mean.
- `contracts` defines how runtimes talk about those concepts.

## Decided
- Shared language is worth naming early because it preserves architecture clarity later.

## Open
- How much validation should live here versus closer to persistence boundaries.

## Deferred
- Shared utilities that do not carry real domain meaning.
