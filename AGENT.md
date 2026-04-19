# AGENT.md

Short hard-rules checklist for AI agents working on this repo. Read this *first*; it overrides default instincts when they conflict.

Other docs give the *why*. This doc gives the *check*.

- [CLAUDE.md](CLAUDE.md) — invariants and boundaries.
- [refineCode.md](refineCode.md) — conventions, file-by-file extraction targets, PR checklist.
- [FOR_HUMAN_CODE--DOC.md](FOR_HUMAN_CODE--DOC.md) — domain vocabulary. Use these names verbatim.

---

## The rule that this doc exists to enforce

**Do not grow god files.** Both historical god files have been split:

- `src/db/workbenchRepository.ts` (2,000 lines) is gone — see [src/db/repositories/](src/db/repositories/) for the per-aggregate owners.
- `src/renderer/App.tsx` (1,700 lines → 354 lines) is now a composition shell. Hooks live in [src/renderer/state/](src/renderer/state/); components live in [src/renderer/features/](src/renderer/features/).

The ongoing rule: **no new features in a file that's already at or above its soft limit.** Features belong in the folder declared for their concern:

- UI feature → `src/renderer/features/<feature>/`
- Hook → `src/renderer/state/use<Thing>.ts`
- DB aggregate mutation → `src/db/repositories/<Aggregate>Repository.ts`
- New event type → add to `src/db/events.ts` and reference via `history.appendEvent(type, ..., payload)`.
- New IPC method → update `HARNESS_CHANNELS`, `HarnessBridge`, preload forwarder, main handler, and add a Zod schema in `src/shared/contracts/harnessSchemas.ts` (see R3).

ESLint's `no-restricted-imports` enforces runtime boundaries automatically. If the linter blocks an import you wanted, the right fix is to move the code, not silence the rule.

---

## Before you write code — land cold

If you just arrived and don't remember the codebase:

1. Read [CLAUDE.md](CLAUDE.md). Invariants, boundaries, and stack are there.
2. Scan [refineCode.md](refineCode.md) §"What to preserve" — these are the conventions, not suggestions.
3. Skim the folder README for the folder you're about to edit. Every `src/*` folder has one in the canonical shape (Status / Owns / Does not own / …).
4. Check [package.json](package.json) scripts before inventing commands. `npm run check` is the canonical gate — typecheck → lint → test → build. Vitest is wired in; `npm run test` handles the better-sqlite3 Node/Electron ABI rebuild dance.

---

## Invariants (violating any of these breaks the product)

Copy from [CLAUDE.md](CLAUDE.md); repeated here so the check is in one place.

- Entities are truth. Documents hold prose only — no metadata rides inside them.
- No stored or precomputed matches. Highlights are derived live from visible text.
- Event-sourced history. Every mutation appends to the event log and/or step log *before* projections update, inside one SQLite transaction.
- Shared `TextAnchor` substrate. Anchors record `documentVersionSeen`; collapsed ranges become `invalid`, never silently "healed."
- Clean clipboard. Derived highlights live in ProseMirror `Decoration`, never in the document model.
- Local-first, single-user. No cloud, no CRDT, no merge.

---

## Hard rules (agent-enforceable)

Before finishing a code change, verify each rule below. If a rule fails, fix it or explain in the PR description why it doesn't apply.

### R1. Runtime boundaries

| You're editing… | You may import from | You must not import from |
| --- | --- | --- |
| [src/renderer/](src/renderer/) | [src/shared/](src/shared/) | `better-sqlite3`, [src/db/](src/db/), [src/main/](src/main/), `electron` (except the bridge on `window`) |
| [src/preload/](src/preload/) | [src/shared/contracts/](src/shared/contracts/), `electron` | [src/db/](src/db/), [src/renderer/](src/renderer/), business logic |
| [src/main/](src/main/) | [src/db/](src/db/), [src/shared/](src/shared/), `electron` | [src/renderer/](src/renderer/) |
| [src/db/](src/db/) | [src/shared/](src/shared/), `better-sqlite3`, `prosemirror-*` | [src/main/](src/main/), [src/renderer/](src/renderer/), `electron` |
| [src/shared/](src/shared/) | nothing platform-specific | `better-sqlite3`, `electron`, `react`, `prosemirror-view` |

### R2. Event sourcing

- Every mutation method on a repository runs inside `sqliteHarness.runInTransaction(...)`.
- Every mutation appends a domain event via `appendEvent(...)` before returning.
- `appendEvent` is only called from inside a transaction callback.
- Current-state tables are projections; they are recomputable from logs + checkpoints. Never write to them without appending the corresponding event.

### R3. IPC contract discipline

Adding a new IPC operation touches *exactly* these locations, in this order:

1. Add the channel key to `HARNESS_CHANNELS` in [src/shared/contracts/harnessApi.ts](src/shared/contracts/harnessApi.ts).
2. Add the method signature to the `HarnessBridge` interface (same file).
3. Add the forwarder in [src/preload/index.ts](src/preload/index.ts) (one line).
4. Add a Zod schema for the input in [src/shared/contracts/harnessSchemas.ts](src/shared/contracts/harnessSchemas.ts).
5. Add the `ipcMain.handle(...)` registration in [src/main/index.ts](src/main/index.ts), wrapping the payload in `parseInput(schema, input, channel)` before calling the repository.

If you find yourself threading a new concept through App.tsx and five utilities instead, you are bending the contract — stop and add a proper channel.

### R4. Domain vocabulary

Use the terms from the vocabulary table in [FOR_HUMAN_CODE--DOC.md](FOR_HUMAN_CODE--DOC.md): `Project`, `DocumentFolder`, `Document`, `DocumentOutlineNode`, `Entity`, `MatchingRule`, `TextAnchor`, `Slice`, `SliceBoundary`, `EntitySlice`, `PendingEverlinkSession`, `AnchorResolutionResult`, `Panel`, `Annotation`, `EventStream`, `DocumentStep`, `DocumentCheckpoint`, `Projection`.

- Do not invent synonyms.
- If you need a new concept, add it to the vocabulary table *before* naming the type.
- "Workspace" is the canonical term; "workbench" survives only in a couple of CSS classes and the Phase 1 proof-workbench planning docs — don't introduce new "workbench" identifiers in code. See [refineCode.md](refineCode.md) §C5.

### R5. Type discipline

- No `any` outside `.d.ts` shims for untyped dependencies.
- `unknown` only at system boundaries (IPC inputs, error catches), narrowed before flowing inward.
- Shared types live in [src/shared/domain/](src/shared/domain/). Do not redefine a type in a feature folder "for convenience."
- `RawXxxRow` types stay inside [src/db/](src/db/). snake_case fields never appear outside that folder.

### R6. File size budgets

| Kind | Soft limit | Hard limit (must split) |
| --- | --- | --- |
| React component | 300 | 500 |
| Custom hook | 150 | 250 |
| Repository module | 400 | 700 |
| IPC / preload / main handler | 150 | 250 |
| Data-only shared types module | 500 | — |

If an edit pushes a file past its soft limit, flag it in the PR description. Past the hard limit, split first.

### R7. Do not re-create god files

The historical god files were split in April 2026. The same discipline that prevented them from growing now prevents them from reappearing:

- A new UI feature belongs in a new file under [src/renderer/features/<feature>/](src/renderer/features/). Don't grow App.tsx.
- A new DB aggregate belongs in a new repository under [src/db/repositories/](src/db/repositories/). Don't grow WorkspaceRepository — it is a composition facade, not a bucket for new mutations.
- A hook that grows past 250 lines splits. Today [useEverlinkPlacement](src/renderer/state/useEverlinkPlacement.ts) is the largest hook in the repo at ~380 lines; it is the cap, not a pattern to copy. If you touch that file for anything but bug fixes, break off the next logical sub-flow first.

### R8. Comment discipline

Default is no comments. Write a comment only when:

- The *why* is non-obvious (hidden constraint, subtle invariant, workaround for a specific bug).
- The comment guides a future refactor (the `EXTRACT →` markers in App.tsx and workbenchRepository.ts are an example).

Do not write comments that re-state what the code does; well-named identifiers already do that. Do not reference "the fix for ticket X" or "the caller at Y" — that rots.

### R9. New folder → new README

Every `src/*` and `docs/*` folder you create must have a README in the canonical shape: **Status / If you landed here first / Parent reads / Owns / Does not own / Key relationships / Decided / Open / Deferred**. No exceptions.

### R10. No premature abstractions

Three similar lines is better than a two-hour abstraction. Don't add flags, hooks, or generics for "future" needs. Don't add error handling for impossible cases. The code should match what's actually being built right now.

---

## Pre-submit checklist

Run through this before saying "done":

- [ ] Invariants (R1, R2, R4, R5) preserved — no renderer-side SQL, no raw rows outside `src/db/`, no invented domain terms, no mutation without event append in a transaction.
- [ ] IPC additions touch exactly the four files listed in R3.
- [ ] No file exceeded its hard limit (R6); no growth in the two flagged god files (R7).
- [ ] New folder → new README (R9).
- [ ] `npm run check` passes (typecheck → lint → test → build).
- [ ] If you touched behavior near an `EXTRACT →` marker, you either extracted first or recorded in the PR description why you deferred.
- [ ] No emoji in code or docs unless the user explicitly asked for it.
- [ ] Commit message focuses on *why*, not *what*.

If the user asked for a UI change, you cannot claim success without running `npm run dev` and exercising the change in the browser. Typecheck proves syntax; it does not prove the feature works.

---

## When to push back

If a user request conflicts with a rule in this doc, surface the conflict before starting:

- They ask you to add a feature directly into App.tsx or into [WorkspaceRepository](src/db/repositories/WorkspaceRepository.ts) (the composition facade) → offer to extract into the matching feature folder or per-aggregate repository first and explain why.
- They ask you to add a cross-cutting type into a feature folder → point at [src/shared/domain/](src/shared/domain/) instead.
- They ask you to bypass the event log for performance → refuse; event sourcing is an invariant, not a preference. Suggest a projection or a read optimization instead.
- They ask for a CRDT / cloud sync / merge flow → refuse; local-first single-user is load-bearing.

A user can override a rule in this doc *for a specific task* with an explicit instruction. They cannot silently override it by asking for a feature whose natural implementation breaks it.
