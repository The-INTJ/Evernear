# ADR-007: Workbench Storage Engine for Phase 1 Proof

## Status
Accepted

## Date
2026-04-17

## Parent reads
- [ADR-002: SQLite First with Portability](./ADR-002-sqlite-first-with-portability.md)
- [ADR-003: Document Persistence and Editor State](./ADR-003-document-persistence-and-editor-state.md)
- [ADR-006: Event-Sourced Document and Metadata History](./ADR-006-event-sourced-document-and-metadata-history.md)

## Context
The original proof harness used `sql.js` and rewrote the whole database file on commit.
That was acceptable for a narrow snapshot-only proof, but it would give misleading results once the Phase 1 workbench started appending document steps, checkpoints, and event rows at typing pace.

## Decision
Use `better-sqlite3` as the local runtime store for the Phase 1 proof workbench.

Run the workbench with:

- SQLite WAL mode
- `synchronous=FULL` as the default proof setting
- one local process-owned database file under `.local/`

## Consequences
- The proof workbench measures against a storage path that is much closer to the real local-app reality.
- Local upgrades need a simple schema-reset path for old proof databases.
- The workbench remains explicitly local-only; this ADR does not change any future portability or packaging decision from ADR-002.

## Decided
- The proof layer should not prove history performance on top of a file-rewrite artifact.

## Open
- Whether later product builds should keep `synchronous=FULL` or compare it more directly against `NORMAL` once the history path is exercised on real prose.
