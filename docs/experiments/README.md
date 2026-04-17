# Experiments

## Status
MVP now

## If you landed here first
Read [FOR_HUMAN_AND_AI_ROADMAP--DOC.md](../../FOR_HUMAN_AND_AI_ROADMAP--DOC.md) first, then [FOR_HUMAN_CODE--DOC.md](../../FOR_HUMAN_CODE--DOC.md). This folder holds the proof work for questions big enough to force a rewrite if guessed wrong.

## Parent reads
- [docs/README.md](../README.md)
- [FOR_HUMAN_AND_AI_ROADMAP--DOC.md](../../FOR_HUMAN_AND_AI_ROADMAP--DOC.md)
- [FOR_HUMAN_CODE--DOC.md](../../FOR_HUMAN_CODE--DOC.md)

## Owns
- Load-bearing experiment briefs.
- Pseudo-build walkthroughs when they are enough to expose architectural friction early.
- Acceptance criteria for spikes that gate later phases.

## Does not own
- Final architecture decisions by itself.
- Routine implementation notes that are not rewrite-risk material.

## Current experiments
- [EXP-001: Shared Anchor Substrate Under Live Edits](./EXP-001-shared-anchor-substrate.md) - Planned
- [EXP-002: Matching Normalization and Chapter-Scale Performance](./EXP-002-matching-normalization-and-scale.md) - Planned
- [EXP-003: Lexical Prototype Walkthrough](./EXP-003-lexical-prototype-walkthrough.md) - Resolved, Lexical not selected
- [EXP-004: ProseMirror Prototype Walkthrough](./EXP-004-prosemirror-prototype-walkthrough.md) - Resolved, ProseMirror selected
- [EXP-005: Event Log and Checkpoint Replay](./EXP-005-event-log-and-checkpoint-replay.md) - Planned
- [EXP-006: Pretext Layout Viability](./EXP-006-pretext-layout-viability.md) - Planned

## Conventions
- Each experiment uses `EXP-NNN-<slug>` and a `Status` of `Planned`, `Running`, `Resolved`, or `Abandoned`.
- Resolved experiments stay here indefinitely. They are the memory of why the project did not pick the other thing.
- Experiments that resolve should produce or update an ADR, then link to it.

## Decided
- Experiments exist to make the expensive unknowns obvious early.
- Resolved experiments remain in the repo rather than being deleted.

## Open
- Which acceptance thresholds should become numeric versus descriptive after the first runnable spikes.

## Deferred
- Low-stakes polish studies.
