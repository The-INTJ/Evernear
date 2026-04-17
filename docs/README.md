# Docs

## Status
MVP now

## If you landed here first
Start with [FOR_HUMAN_BUSINESS--DOC.md](../FOR_HUMAN_BUSINESS--DOC.md), [FOR_HUMAN_CODE--DOC.md](../FOR_HUMAN_CODE--DOC.md), and [FOR_HUMAN_AND_AI_ROADMAP--DOC.md](../FOR_HUMAN_AND_AI_ROADMAP--DOC.md). This folder is for durable cross-cutting documentation that should outlive any one implementation pass.

## Parent reads
- [FOR_HUMAN_BUSINESS--DOC.md](../FOR_HUMAN_BUSINESS--DOC.md)
- [FOR_HUMAN_CODE--DOC.md](../FOR_HUMAN_CODE--DOC.md)
- [FOR_HUMAN_AND_AI_ROADMAP--DOC.md](../FOR_HUMAN_AND_AI_ROADMAP--DOC.md)

## Owns
- Cross-cutting documentation that is not best owned by a source folder.
- Durable feature briefs for workflows that would otherwise get reinvented during implementation.
- ADRs and other long-lived decision history.
- The shared glossary for product and architecture language.
- Experiments that are important enough to gate later phases.
- Reusable documentation templates.

## Does not own
- Source-folder runtime boundaries.
- Product logic by itself.

## Key relationships
- `adr` stores the most durable architecture decisions.
- `experiments` stores the load-bearing proof work.
- top-level `FB-*` docs capture workflow-specific decisions that are more detailed than the north-star docs but not durable enough to become ADRs
- `glossary` stores the canonical terminology that the rest of the repo should reuse directly.
- `templates` stores reusable doc starting points for future passes.

## Decided
- Important decisions should be easy to find without hunting through narrative docs.
- Hard rewrite risks should be visible before implementation momentum hides them.

## Open
- Whether `open-questions` needs its own cross-cutting folder or should remain near the code areas that surface those questions.

## Deferred
- A larger documentation taxonomy until the codebase earns it.
