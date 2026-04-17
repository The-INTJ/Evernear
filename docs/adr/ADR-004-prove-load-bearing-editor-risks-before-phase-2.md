# ADR-004: Prove Load-Bearing Editor Risks Before Phase 2

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
- matching normalization and performance at realistic manuscript scale
- picking an editor host that does not force accidental infrastructure work
- keeping document persistence simple enough to trust

If feature work starts before those are proven well enough, the codebase can look productive while still heading toward a rewrite.

## Decision
Phase 2 is gated by Phase 1 proof work.

Before the foundational shell is treated as settled, the repo should have current experiment records for:

- shared anchor healing for slice boundaries and annotations
- matching normalization and performance
- editor-host fit
- document snapshot round-tripping

The editor-host comparison may start with pseudo-build walkthroughs, but it should not be treated as closed unless one option is clearly less accidental work for Evernear's anchored-range workflow.

## Consequences
- Early progress becomes slightly slower on paper, but much safer in practice.
- The hard problems stay explicit instead of being buried under feature checklists.
- Future AI passes have a clear rule for when to stop adding product surface and return to proof work.

## Decided
- Load-bearing proof now is cheaper than architectural regret later.

## Open
- The exact numeric thresholds for matching and anchor-healing acceptance.

## Deferred
- A broader milestone governance process beyond what this repo currently needs.
