# refineCode.md

Coding practices for Evernear. Grounded in the MVP as it stands today (v0.3.0, ~5.5k LOC across [src/](src)). The goal is a codebase that can survive the next 10x in size without a rewrite.

Read [CLAUDE.md](CLAUDE.md) first for invariants. This doc is the next layer down: conventions, what to preserve, what to change, what to add.

## Status

Living document. Update it when a convention is adopted, retired, or contradicted.

**Last updated 2026-04-18.** The foundation refactor pass landed: god files split, migrations framework, typed event catalog, anchor-math unified between DB and renderer (with off-by-one fix), IPC validation at the trust boundary, Vitest suite covering anchoring + repository integration, ESLint with runtime-boundary enforcement. See CLAUDE.md "Current stage" for the live state and [package.json](package.json) for the current script surface.

## Parent reads

- [CLAUDE.md](CLAUDE.md) — non-negotiable invariants
- [FOR_HUMAN_CODE--DOC.md](FOR_HUMAN_CODE--DOC.md) — architecture and domain vocabulary
- [docs/adr/](docs/adr/) — durable decisions

---

## The guiding lens

Three questions for every change:

1. **Does it preserve the load-bearing invariants?** Entities are truth, documents are projection surfaces, no stored matches, event-sourced, shared `TextAnchor` substrate, clean clipboard, local-first. ([CLAUDE.md](CLAUDE.md))
2. **Does it respect the runtime boundary it sits in?** Renderer never sees SQL; preload carries no business logic; main is the trust boundary; shared holds contracts and domain types only.
3. **Can the next person delete or replace this without archaeology?** If a reader needs to reconstruct your intent from git blame, the code or a README is missing a load-bearing sentence.

---

## What to preserve (codify as convention)

These patterns already exist in the code and are working. Keep doing them; don't let drift erode them.

### 1. One typed IPC contract, no handwritten marshaling

[src/shared/contracts/harnessApi.ts](src/shared/contracts/harnessApi.ts) exposes `HARNESS_CHANNELS` (string constants, `as const`) and a `HarnessBridge` interface. [src/preload/index.ts](src/preload/index.ts) is a mechanical one-liner per channel. [src/main/index.ts:34](src/main/index.ts) registers handlers by iterating the same channel constants.

**Rule:** a new IPC operation touches *three* files and nothing else — channel constant, interface signature, preload forwarder, main handler. No other file needs to change. If you find yourself threading a new concept through App.tsx and five utilities to add one RPC, stop and check whether you're bending the contract or extending it.

### 2. Domain types live in [src/shared/domain/](src/shared/domain/), imported everywhere else

Both renderer and repositories import `TextAnchor`, `EntityRecord`, `SliceRecord`, etc. from [src/shared/domain/workspace.ts](src/shared/domain/workspace.ts). No parallel definitions.

**Rule:** if a type is used on both sides of a runtime boundary, it lives in `src/shared/domain/`. If you feel tempted to redefine it in a feature folder "for convenience," you are about to create the drift the shared module exists to prevent.

### 3. Row shapes stay in the DB layer

[src/db/rowTypes.ts](src/db/rowTypes.ts) declares `RawProjectRow`, `RawFolderRow`, etc. with snake_case columns, and [src/db/rowMappers.ts](src/db/rowMappers.ts) maps them to domain shapes. These types never leave the DB module — everything above gets the domain shape.

**Rule:** no `snake_case` field ever appears in [src/shared](src/shared), [src/renderer](src/renderer), or [src/main](src/main). Decoding is the repository's job.

### 4. Append-then-project inside one transaction

Every mutation in [src/db/repositories/](src/db/repositories/) is wrapped in `sqliteHarness.runInTransaction(...)`. Inside: update projections and call `history.appendEvent(...)` in the same callback. See [ProjectRepository.createProject](src/db/repositories/ProjectRepository.ts), [FolderRepository.updateFolder](src/db/repositories/FolderRepository.ts), [DocumentRepository.applyDocumentTransaction](src/db/repositories/DocumentRepository.ts). Cross-aggregate writes compose through [WorkspaceRepository](src/db/repositories/WorkspaceRepository.ts).

**Rule:** a public repository method either runs in a transaction or returns a pure read. No mutation escapes `runInTransaction`. No event is appended without its projection update. Reviewers should block any PR that calls `appendEvent` outside a transaction or updates a projection without appending an event.

### 5. Folder README convention

Every folder under [src/](src) and [docs/](docs) has a README with the sections: Status / If you landed here first / Parent reads / Owns / Does not own / Key relationships / Decided / Open / Deferred.

**Rule:** new folder → new README in that shape. No exceptions. This is the chain-up rule that keeps the repo navigable by someone who lands cold.

### 6. Domain vocabulary is canonical

`Entity`, `Slice`, `TextAnchor`, `DocumentStep`, `MatchingRule`, `EntitySlice`, `PendingEverlinkSession` — these names come from [FOR_HUMAN_CODE--DOC.md](FOR_HUMAN_CODE--DOC.md). The code already uses them.

**Rule:** don't invent synonyms. If you feel a new concept emerging, add it to the vocabulary table in `FOR_HUMAN_CODE--DOC.md` *before* you name the type. Reviewers should reject types whose names aren't in the vocabulary.

### 7. Strict TypeScript, no `any`, minimal `unknown`

Current `unknown` usage is confined to error-catch sites and one internal JSON utility. `any` does not appear.

**Rule:** `any` is banned outside `.d.ts` shims for untyped dependencies. `unknown` is acceptable at system boundaries (error handlers, untyped external input) but must be narrowed before flowing inward. If you need either, write a one-line comment on why.

---

## What to change (rough edges that will not scale)

> **Status update (2026-04-19):** items C1, C2, C3, C4, C7, A1 (load-bearing paths), A2, A3, A5, A6, A7 below have landed. Remaining: C5 cosmetic ("workbench" in `pm-workbench` CSS class + `leakedWorkbenchMarkup` flag + stray doc phrasing), C6 (targeted projection reads), C8 (incremental decoration diffing), A1 UI tests, A4 structured errors. Completed items are kept here as a record of the pattern — match them when touching adjacent code.

### C1. Decompose [src/renderer/App.tsx](src/renderer/App.tsx) (1,733 lines) — DONE

A single component now holds 15+ `useState` hooks, Everlink session logic, pending-slice placement, clipboard auditing, workspace dispatch, and layout rendering. This is already slowing iteration and will rot quickly.

**Plan (no behavior change):**

- Extract custom hooks: `useWorkspace` (status, workspace state, persistence queue), `useEverlinkSession`, `usePendingPlacement`, `useRunLog`, `useClipboardAudit`.
- Extract components per feature area into the already-pre-declared folders [src/renderer/features/projects/](src/renderer/features/projects/), [documents/](src/renderer/features/documents/), [entities/](src/renderer/features/entities/), [panes/](src/renderer/features/panes/), [annotations/](src/renderer/features/annotations/), [history/](src/renderer/features/history/). The READMEs are already written — only the code is missing.
- App.tsx should end up as a shell that composes features, not a god component. Target: under 300 lines.

**Rule going forward:** no renderer file exceeds ~400 lines without a justification in the PR description. At 600 lines it must be split before merge.

### C2. Split [src/db/workbenchRepository.ts](src/db/workbenchRepository.ts) (2,000 lines) along the already-declared seams — DONE

[src/db/repositories/README.md:25-32](src/db/repositories/README.md) already names the aggregates: `ProjectRepository`, `DocumentRepository`, `EntityRepository`, `SliceRepository`, `AnnotationRepository`, `HistoryRepository`, `WorkspaceRepository`. Today they all live in one file as one class.

**Plan:** move each aggregate's public methods and private helpers into its own file under [src/db/repositories/](src/db/repositories/). Keep one thin `WorkspaceRepository` that composes the others for cross-aggregate reads (loadWorkspace). Transaction boundaries and event-append discipline stay identical — this is a mechanical extraction.

### C3. Validate at the IPC trust boundary, not before it — DONE

[src/preload/index.ts](src/preload/index.ts) forwards whatever the renderer passes. [src/main/index.ts:37-66](src/main/index.ts) trusts the typed input, but at runtime this is just `unknown` JSON crossing a process boundary. A bug in the renderer can corrupt persistent state.

**Plan:** add runtime validation at each `ipcMain.handle` site. Option A: Zod schemas colocated with the input types in `src/shared/domain/workspace.ts` (schema + `z.infer` type). Option B: hand-rolled guards. Either is fine; what matters is that main never calls into a repository with an unvalidated payload. Preload stays dumb — validation is the main process's job because main is the trust boundary.

### C4. Stop magic-stringing event types — DONE

Event names are now a typed closed union in [src/db/events.ts](src/db/events.ts). `history.appendEvent(type, aggregateType, aggregateId, payload)` is generic over the event catalog; a misspelled event name is a compile error and the payload shape is checked against the event type.

### C5. Resolve the "workbench" vs "workspace" naming drift — MOSTLY DONE

The file rename is done: `workbenchRepository.ts` is gone, replaced by per-aggregate repositories under [src/db/repositories/](src/db/repositories/) composed by [WorkspaceRepository](src/db/repositories/WorkspaceRepository.ts). Domain module is [src/shared/domain/workspace.ts](src/shared/domain/workspace.ts). "Workspace" is the chosen term at the class and state level.

**Remaining sweeps:** the `pm-workbench` CSS class in [src/renderer/editor/editorUtils.ts](src/renderer/editor/editorUtils.ts), the `leakedWorkbenchMarkup` flag on the clipboard audit shape in [src/shared/domain/workspace.ts](src/shared/domain/workspace.ts), and the `workbench` phrasing that still appears in the Phase 1 proof-workbench planning docs and experiment briefs (where it refers to the Phase 1 proof workbench, a historical concept — fine to leave there). None are load-bearing; batch them into the next renderer-touch PR.

### C6. Replace "refetch the world" with targeted projection reads

Every mutation still ends with `return this.loadWorkspace();` (see [WorkspaceRepository](src/db/repositories/WorkspaceRepository.ts) and the per-aggregate repos). At MVP scale this is fine; once a project has thousands of entities and long documents, a folder rename shouldn't re-serialize every document snapshot.

**Plan:** not urgent, but when it starts to hurt: return a diff (`WorkspaceStateDelta`) from mutations and have the renderer apply it. Keep `loadWorkspace()` as the initial-load and safety-net path. Don't do this until you have a profiler telling you to.

### C7. Schema migrations, not `CREATE TABLE IF NOT EXISTS` — DONE

Migrations now live in [src/db/migrations.ts](src/db/migrations.ts) — ordered, `user_version`-driven, transactional. On open the bootstrap compares `user_version` and runs pending migrations in order inside a transaction. Covered by [src/db/migrations.test.ts](src/db/migrations.test.ts).

### C8. Editor decorations: don't recompute on every transaction

[HarnessEditor.tsx](src/renderer/editor/HarnessEditor.tsx) rebuilds the full `DecorationSet` on every document change. That's fine for a 10-page draft; for a novel-length document with hundreds of matches it will stutter.

**Plan:** when profiling shows the cost, move to a ProseMirror plugin that maps decorations forward through each transaction and only recomputes the ranges that actually changed (via `tr.mapping`). Not a premature optimization target — but leave a breadcrumb here so it's not forgotten.

---

## What to add

### A1. Tests. Any tests. — DONE for anchoring + repository integration + IPC contract + migrations; UI tests still open.

Vitest is wired in. `npm run test` rebuilds the better-sqlite3 binding for Node, runs the suite against a real SQLite file, then rebuilds for Electron. Tests live next to source.

Current coverage:

1. **Anchor resolution** — [src/shared/anchoring.test.ts](src/shared/anchoring.test.ts) covers resolved / repaired / ambiguous / invalid, and [src/renderer/editor/editorUtils.test.ts](src/renderer/editor/editorUtils.test.ts) covers anchor selection building.
2. **Repository integration** against real SQLite — [WorkspaceRepository.test.ts](src/db/repositories/WorkspaceRepository.test.ts), [DocumentRepository.test.ts](src/db/repositories/DocumentRepository.test.ts), [EntityRepository.test.ts](src/db/repositories/EntityRepository.test.ts), [HistoryRepository.test.ts](src/db/repositories/HistoryRepository.test.ts). Covers bootstrap, CRUD, event-sourcing invariants (one event per mutation, monotonic `aggregate_seq`), cascade atomicity, and replay from checkpoints.
3. **IPC contract symmetry** — [src/shared/contracts/harnessApi.test.ts](src/shared/contracts/harnessApi.test.ts) asserts every `HARNESS_CHANNELS` key has a matching `HarnessBridge` method, Zod schema, and main-handler registration.
4. **Schema migrations** — [src/db/migrations.test.ts](src/db/migrations.test.ts).
5. **Clipboard prose-only invariant** — [src/renderer/editor/HarnessEditor.test.ts](src/renderer/editor/HarnessEditor.test.ts).

**Still open:** Playwright-style smoke tests for the Everlink + Everslice + slice-commit UI flows. Feature components under [src/renderer/features/](src/renderer/features/) are untested end-to-end.

### A2. Lint and format enforcement — DONE

No ESLint. No Prettier. Inconsistencies are already visible across files.

**Minimal config:**

- ESLint with `@typescript-eslint/recommended`, `react-hooks`, and a custom rule set that enforces the boundary rules: `no-restricted-imports` banning `src/db/**` from `src/renderer/**`, banning `better-sqlite3` anywhere outside `src/db/**`, banning `electron` imports outside `src/main/**` and `src/preload/**`.
- Prettier with repo defaults.
- `npm run check` already exists; add `lint` and `format:check` to it.

A pre-commit hook is optional; CI running `npm run check` is mandatory once there's a CI.

### A3. A typed event catalog (see C4)

### A4. Structured error taxonomy

Today errors surface via `console.error("Failed to start Evernear.", error)` ([main/index.ts:106](src/main/index.ts)) and `stringifyError` in the renderer run log. For a local-first app, errors must be actionable to the user, not swallowed.

**Plan:** a small `AppError` class with a `code` enum (`DB_LOCKED`, `ANCHOR_UNRESOLVABLE`, `MIGRATION_FAILED`, …) and a user-facing message. Repository methods throw typed errors; main catches at the IPC boundary and returns `{ ok: false, code, message }` to the renderer. The renderer's run log becomes the one place error UX is centralized.

### A5. A migrations mechanism (see C7)

### A6. An `ARCHITECTURE.md` or expand [FOR_HUMAN_CODE--DOC.md](FOR_HUMAN_CODE--DOC.md) — DONE

[FOR_HUMAN_CODE--DOC.md](FOR_HUMAN_CODE--DOC.md) now has a "Current implementation map" section listing where every domain concept lives in code. Update it whenever a concept moves.

### A7. CLAUDE.md correction — DONE

[CLAUDE.md](CLAUDE.md) now correctly reflects the Phase 1.5 foundation-hardened state, the post-split god-file status, and the real command surface.

---

## File-size and complexity budgets

Not a hard lint rule — a review signal. If a PR pushes a file past these, it should either be split or the description should say why this one is justified.

| File type | Soft limit | Hard limit (split before merge) |
| --- | --- | --- |
| React component | 300 lines | 500 lines |
| Custom hook | 150 lines | 250 lines |
| Repository module | 400 lines | 700 lines |
| Shared types module | 500 lines (data-only, fine to exceed) | — |
| IPC/handler/preload | 150 lines | 250 lines |

Current watch list (2026-04-19):

- [HarnessEditor.tsx (536)](src/renderer/editor/HarnessEditor.tsx) — above the 500-line React component hard cap. Next feature that touches it must extract first (candidates: the decoration-building pass, the clipboard handler).
- [WorkspaceRepository.ts (564)](src/db/repositories/WorkspaceRepository.ts) — above the 400-line repository soft cap but under the 700 hard cap. Fine for now because it's a thin composition facade; watch it if new cross-aggregate methods pile on.
- [App.tsx (395)](src/renderer/App.tsx) — above the 300 soft cap, under the 500 hard cap. New composition of existing features goes here; new feature *logic* must extract into [src/renderer/features/](src/renderer/features/) or [src/renderer/state/](src/renderer/state/).

---

## Code-review checklist

For every non-trivial PR, the reviewer confirms:

- [ ] No invariant from [CLAUDE.md](CLAUDE.md) is violated (entities-as-truth, append-then-project, clean clipboard, etc.).
- [ ] Runtime boundary is respected — no renderer-side SQL, no DB-side JSX, no business logic in preload.
- [ ] Domain terms match the [FOR_HUMAN_CODE--DOC.md](FOR_HUMAN_CODE--DOC.md) vocabulary.
- [ ] Every mutation is inside `runInTransaction` and appends a domain event.
- [ ] Every new IPC operation updates: channel constant, `HarnessBridge` method, preload forwarder, main handler, and (future) runtime validator.
- [ ] New folder → new README in the canonical shape.
- [ ] No `any`; `unknown` only at boundaries with narrowing.
- [ ] File size budgets respected, or the PR explains why not.
- [ ] Tests cover behavior that would be expensive to debug from a user's corrupt project file (anchor resolution, replay, migrations).

---

## Decided

- Patterns in "What to preserve" are conventions, not suggestions — reviewers enforce them.
- Decomposition of the historical god files (`App.tsx`, `workbenchRepository.ts`) into the pre-declared folders landed in Phase 1.5. The rule now is: don't let them re-form.
- Tests are a Phase 1.5 blocker, not a Phase 2 nice-to-have. Load-bearing paths (anchoring, repositories, IPC symmetry, migrations, clipboard invariant) are covered; UI end-to-end is still open.
- Vitest is the runner. Zod is the IPC validator.

## Open

- Whether live matching-rule compilation belongs beside `EntityRepository` or in a dedicated `src/shared/matching/` module.
- Whether a Playwright-style UI harness earns its weight for the Everlink + Everslice commit flows, or whether component-level interaction tests are enough.

## Deferred

- Performance-driven rewrites (C6 delta sync, C8 decoration diffing) — wait for a profiler to complain.
- Plugin-style internal feature system (mentioned in [src/renderer/features/README.md](src/renderer/features/README.md)).
- Anything CRDT-shaped — local-first single-user is a load-bearing invariant, not a Phase 2 detail.
