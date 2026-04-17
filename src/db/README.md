# Database Layer

## Status
MVP now

## If you landed here first
Read [FOR_HUMAN_CODE--DOC.md](../../FOR_HUMAN_CODE--DOC.md) first, then [FLOW.md](./FLOW.md). This folder owns the SQLite-first stance and the author-ownership guarantee around it.

## Parent reads
- [src/README.md](../README.md)
- [FOR_HUMAN_CODE--DOC.md](../../FOR_HUMAN_CODE--DOC.md)
- [ADR-002](../../docs/adr/ADR-002-sqlite-first-with-portability.md)

## Owns
- SQLite project storage.
- Schema direction and migrations.
- Repository boundaries.
- Export and package support so author ownership remains real.

## Does not own
- UI composition.
- Electron lifecycle policy.
- Shared domain naming by itself.

## Inputs and outputs
- Inputs: project path, domain writes, query requests, export intents.
- Outputs: persisted project data, typed query results, portable project packages or exports.

## Key relationships
- Works from shared domain concepts, not the other way around.
- Serves `main` and the rest of the app through repository and contract layers.

## Likely future code here
- `sqlite-bootstrap`
- `migrations`
- `repositories`
- `export-service`

## Decided
- SQLite is the canonical runtime store.
- Portability and export are part of the database-layer responsibility, not a bolt-on utility.

## Open
- The exact local project package shape.
- Whether export is bundle-first, plain-text-first, or dual-mode.

## Deferred
- Remote sync or network-aware persistence.
