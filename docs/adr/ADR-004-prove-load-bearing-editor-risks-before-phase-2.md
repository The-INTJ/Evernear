# ADR-004: Prove Load-Bearing Risks Before Phase 2

## Status
Accepted

## Date
2026-04-17

## Parent reads
- [FOR_HUMAN_AND_AI_ROADMAP--DOC.md](../../FOR_HUMAN_AND_AI_ROADMAP--DOC.md)
- [FOR_HUMAN_CODE--DOC.md](../../FOR_HUMAN_CODE--DOC.md)
- [docs/experiments/README.md](../experiments/README.md)

## Context
The most expensive rewrite risks in Evernear are not shell setup risks.
They are:

- anchored ranges surviving live edits
- live visible-range matching, rule normalization, and invalidation while typing
- event-log and checkpoint replay drifting from current-state projections
- understanding whether Pretext changes the long-document layout picture
- keeping document persistence simple enough to trust

Editor-host fit was part of this risk bundle originally and is now resolved by EXP-003, EXP-004, and ADR-005. The remaining Phase 1 proof work still blocks the foundational shell.

If feature work starts before these are proven well enough, the codebase can look productive while still heading toward a rewrite.

## Decision
Phase 2 is gated by Phase 1 proof work.

Before the foundational shell is treated as settled, the repo should have current experiment records for:

- shared anchor healing for slice boundaries and annotations
- live visible-range matching and rule normalization
- event-log and checkpoint replay, including rebuild-from-log verification
- Pretext layout viability
- document snapshot round-tripping

## Consequences
- Early progress becomes slightly slower on paper, but much safer in practice.
- The hard problems stay explicit instead of being buried under feature checklists.
- Future AI passes have a clear rule for when to stop adding product surface and return to proof work.

## Decided
- Load-bearing proof now is cheaper than architectural regret later.

## Open
- The exact numeric thresholds for matching, anchor-healing, and replay acceptance.

## Deferred
- A broader milestone governance process beyond what this repo currently needs.
