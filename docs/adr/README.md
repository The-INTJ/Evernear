# Architecture Decision Records

## Status
MVP now

## If you landed here first
Read [docs/README.md](../README.md) first, then [FOR_HUMAN_CODE--DOC.md](../../FOR_HUMAN_CODE--DOC.md). This folder holds the decisions that should stay stable enough to reference later.

## Parent reads
- [docs/README.md](../README.md)
- [FOR_HUMAN_CODE--DOC.md](../../FOR_HUMAN_CODE--DOC.md)
- [FOR_HUMAN_AND_AI_ROADMAP--DOC.md](../../FOR_HUMAN_AND_AI_ROADMAP--DOC.md)

## Owns
- Durable architecture decisions with context and consequences.

## Does not own
- Everyday implementation notes.
- Product-roadmap reasoning in isolation.

## Current ADRs
- [ADR-001: Stack and Shell Baseline](./ADR-001-stack-and-shell-baseline.md)
- [ADR-002: SQLite First with Portability](./ADR-002-sqlite-first-with-portability.md)
- [ADR-003: Document Persistence and Editor State](./ADR-003-document-persistence-and-editor-state.md)
- [ADR-004: Prove Load-Bearing Editor Risks Before Phase 2](./ADR-004-prove-load-bearing-editor-risks-before-phase-2.md)
- [ADR-005: Editor Foundation Locked to ProseMirror](./ADR-005-editor-foundation-locked-to-prosemirror.md)
- [ADR-006: Event-Sourced Document and Metadata History](./ADR-006-event-sourced-document-and-metadata-history.md)
- [ADR-007: Workbench Storage Engine for Phase 1 Proof](./ADR-007-workbench-storage-engine-for-phase-1-proof.md)

## Decided
- ADRs should stay lightweight in this phase.
- The hardest editor and persistence decisions are already important enough to record here.

## Open
- When to start recording more granular implementation decisions here.

## Deferred
- A heavyweight RFC process.
