# Docs

## Status
MVP now

## If you landed here first
Start with [FOR_HUMAN_BUSINESS--DOC.md](../FOR_HUMAN_BUSINESS--DOC.md) and [FOR_HUMAN_CODE--DOC.md](../FOR_HUMAN_CODE--DOC.md). This folder is for durable cross-cutting documentation that should outlive any one implementation pass.

## Parent reads
- [FOR_HUMAN_BUSINESS--DOC.md](../FOR_HUMAN_BUSINESS--DOC.md)
- [FOR_HUMAN_CODE--DOC.md](../FOR_HUMAN_CODE--DOC.md)

## Owns
- Cross-cutting documentation that is not best owned by a source folder.
- ADRs and other long-lived decision history.
- The shared glossary for product and architecture language.

## Does not own
- Source-folder runtime boundaries.
- Product logic by itself.

## Key relationships
- `adr` stores the most durable architecture decisions.
- `glossary` stores the canonical terminology that the rest of the repo should reuse directly.

## Decided
- Important decisions should be easy to find without hunting through narrative docs.

## Open
- What additional doc categories are worth adding before implementation starts in earnest.

## Deferred
- A larger documentation taxonomy until the codebase earns it.
