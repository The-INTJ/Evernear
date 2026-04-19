# Phase 1.5 Foundation Hardening

Date: 2026-04-18. Branch: `claude/elegant-ptolemy-a80b4d`.

MVP features were working but the foundation had two god files, no tests, no lint, no schema migrations, no IPC validation, and an off-by-one bug lurking in the anchor math. This pass closed those gaps.

## What changed

- **DB layer split** into seven aggregate repositories under [src/db/repositories/](../src/db/repositories/), composed by a thin [WorkspaceRepository](../src/db/repositories/WorkspaceRepository.ts) facade. The old [src/db/workbenchRepository.ts](../src/db/workbenchRepository.ts) (2,188 lines) is gone. Cross-aggregate writes stay atomic because the facade wraps them in one `runInTransaction`.
- **Anchor math unified** and moved to [src/shared/anchoring.ts](../src/shared/anchoring.ts) — used by both DB (boundary repair after every step) and renderer (building anchors from selections). Previous duplicate lived in `src/renderer/editor/workbenchUtils.ts` (since renamed to [editorUtils.ts](../src/renderer/editor/editorUtils.ts)).
- **walkNodeText off-by-one fixed.** When descending into an inline text child, the recursion used to add `+1` (correct for nested block children, wrong for text). Result: `resolveAnchorWithFallback` produced ranges shifted by one character; the bug was latent because `buildTextAnchorFromSelection` took PM positions directly from the editor. Now repaired anchors land where they should.
- **Typed event catalog** in [src/db/events.ts](../src/db/events.ts). Event names are a closed union; misspellings in `history.appendEvent(...)` are compile errors.
- **Schema migrations** in [src/db/migrations.ts](../src/db/migrations.ts) — `user_version`-driven, ordered, transactional. The ad-hoc `CREATE TABLE IF NOT EXISTS` + `ensureColumn` helpers from the old `src/db/schema.ts` were folded into [migrations.ts](../src/db/migrations.ts) itself as legacy-shape repair for pre-Phase-1.5 databases; the schema now evolves through numbered migrations only.
- **Zod validation at the IPC trust boundary.** Every `ipcMain.handle` wraps its payload in [parseInput](../src/shared/contracts/harnessSchemas.ts) before reaching a repository. Malformed payloads throw before touching SQLite.
- **Renderer split.** [src/renderer/App.tsx](../src/renderer/App.tsx) went from 1,865 lines to 354 — it composes hooks (in [src/renderer/state/](../src/renderer/state/)) and feature components (in [src/renderer/features/](../src/renderer/features/)). No new features should land in App.tsx.
- **Vitest suite.** [src/shared/anchoring.test.ts](../src/shared/anchoring.test.ts) covers resolved / repaired / ambiguous / invalid outcomes for boundary repair. [src/db/repositories/WorkspaceRepository.test.ts](../src/db/repositories/WorkspaceRepository.test.ts) covers bootstrap, CRUD, event-sourcing invariants (one-event-per-mutation, monotonic `aggregate_seq`), and cross-aggregate cascade atomicity against a real SQLite file. `npm run test` handles the better-sqlite3 Node/Electron ABI dance.
- **ESLint + Prettier.** [eslint.config.mjs](../eslint.config.mjs) enforces runtime boundaries via `no-restricted-imports`: renderer can't import from db/main, preload has no business logic, db can't pull electron, shared can't pull any platform-specific package. `npm run check` = typecheck → lint → test → build.

## Metrics

- `src/db/workbenchRepository.ts`: 2,188 → 0 (replaced by ~1,900 lines across eight repository modules + three support modules, each within budget).
- `src/renderer/App.tsx`: 1,865 → 354. Logic extracted into five hooks + twelve feature components + two util files + one session-types module.
- Tests: 0 → 20 (10 anchoring + 10 repository integration).
- `npm run check` ran clean end to end.

## What stays open

- **C5 (workbench/workspace naming).** The vocabulary now uses "Workspace" consistently at the class level but the folder README heading "Workbench" still appears in a couple of places. Worth a sweep.
- **C6 (targeted projection reads).** Every mutation still returns the full `WorkspaceState`. Fine at MVP scale. When it bites, introduce a `WorkspaceStateDelta` return shape.
- **C8 (incremental decoration diffing in HarnessEditor).** Same principle — wait for a profiler.
- **UI tests.** The repository + anchoring suites cover the load-bearing algorithms; feature components are still untested. Prefer Playwright-style smoke tests for the Everlink + slice-commit flow if we add a runner.
- **Structured errors.** [AppError](../refineCode.md) with an enum `code` is still worth adding — right now errors surface as generic `Error` instances with stringified messages.

## How to extend

Everything that used to require surgery on a 2,000-line file now has a small, obvious home:

- New IPC method → three files in [src/shared/contracts/](../src/shared/contracts/) + main handler + preload forwarder. Zod schema is mandatory.
- New event → add to [src/db/events.ts](../src/db/events.ts); typed payload, misspellings compile-error.
- New UI feature → new folder under [src/renderer/features/](../src/renderer/features/) with a README, feature components, and (if needed) a hook under [src/renderer/state/](../src/renderer/state/).
- New aggregate → new repository under [src/db/repositories/](../src/db/repositories/), wired into [WorkspaceRepository](../src/db/repositories/WorkspaceRepository.ts), migration added to [migrations.ts](../src/db/migrations.ts).

The conventions that keep these files from regrowing into god files are in [CLAUDE.md](../CLAUDE.md), [refineCode.md](../refineCode.md), and [AGENT.md](../AGENT.md) — in that order of depth.
