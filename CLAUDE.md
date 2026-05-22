# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current stage: Phase 1.5 MVP, foundation hardened

The repo has a runnable Electron app (v0.3.0): ProseMirror editor, SQLite persistence with event-sourced history, typed IPC contract with runtime validation, migration framework, and a Vitest suite covering the anchor-math + repository path.

The two god files that earlier versions of this doc flagged — renderer `App.tsx` (~1,700 lines) and `workbenchRepository.ts` (~2,000 lines) — have been split:

- DB layer split along the aggregates pre-declared in [src/db/db-docs.html#src-db-repositories](src/db/db-docs.html#src-db-repositories). Each aggregate owns its own repository; [WorkspaceRepository](src/db/repositories/WorkspaceRepository.ts) is a thin composition facade. Pure ProseMirror anchor math lives in [src/shared/anchoring.ts](src/shared/anchoring.ts) (used by both DB and renderer).
- Renderer split into hooks under [src/renderer/state/](src/renderer/state/) and feature components under [src/renderer/features/](src/renderer/features/). `App.tsx` is now a composition shell; no new features should go there.

Working commands:

| Command | What it does |
| --- | --- |
| `npm run dev` | Electron + Vite + tsup watcher |
| `npm run typecheck` | strict `tsc --noEmit` |
| `npm run lint` | ESLint with runtime-boundary rules |
| `npm run test` | Vitest. Rebuilds the better-sqlite3 native binding for Node, runs the suite, rebuilds for Electron. ~30s. |
| `npm run test:only` | Vitest without the ABI dance (use only after you know the binding is on Node). |
| `npm run format` / `format:check` | Prettier |
| `npm run check` | typecheck → lint → test → build (the canonical gate) |

Before inventing a new command, read [package.json](package.json).

## Doc hierarchy and contradiction rule

Read in this order when you land cold:

1. [Product_Guide.html](Product_Guide.html) — the north star. Deliberately short. **When it contradicts longer docs, the Product Guide wins.**
2. [FOR_HUMAN_BUSINESS--DOC.html](FOR_HUMAN_BUSINESS--DOC.html) — product strategy and positioning.
3. [FOR_HUMAN_CODE--DOC.html](FOR_HUMAN_CODE--DOC.html) — architecture, domain vocabulary, runtime boundaries. This is the canonical source for domain terms (`Entity`, `Slice`, `TextAnchor`, `DocumentStep`, etc.) — reuse them verbatim.
4. [FOR_HUMAN_AND_AI_ROADMAP--DOC.html](FOR_HUMAN_AND_AI_ROADMAP--DOC.html) — phased execution plan and load-bearing spikes.

Durable decisions live in [docs/adr/adr-index.html](docs/adr/adr-index.html). Workflow-level decisions more specific than the north-star docs but not durable enough to be ADRs live in [docs/docs-index.html](docs/docs-index.html) (for example, FB-001 and FB-002). Proof work lives in [docs/experiments/experiments-index.html](docs/experiments/experiments-index.html).

Coding conventions and the rules that keep the code maintainable as it scales live in [refineCode.html](refineCode.html) (the full convention layer) and [AGENT.md](AGENT.md) (a shorter hard-rules checklist an agent must pass before finishing a task). **If you are an AI agent working on code in this repo, read [AGENT.md](AGENT.md) now — it is short and the rules are enforceable.**

## HTML-first documentation rule

Except for [AGENT.md](AGENT.md) and this file, durable repo docs are HTML by default. This is intentional: HTML lets humans read dense material visually while agents use explicit line ranges to avoid unnecessary context ingest.

- Prefer high-density forms when they are clearer than prose: tables, grids, timelines, swimlanes, SVG/HTML diagrams, compact cards, and collapsible sections.
- Every substantial HTML doc should be mobile responsive, directly browser-openable, and have a header with purpose, audience, stable section anchors, and an **Agent Context Index** with line ranges.
- For dense visual sections, add hidden HTML comments when the visual is easy for a human to digest but would hide ordering, invariants, provenance, or failure-mode nuance from an agent.
- Keep consolidation local to a folder or subsystem. Current consolidated docs are [docs/docs-index.html](docs/docs-index.html), [docs/adr/adr-index.html](docs/adr/adr-index.html), [docs/experiments/experiments-index.html](docs/experiments/experiments-index.html), [docs/templates/templates-index.html](docs/templates/templates-index.html), [src/src-docs.html](src/src-docs.html), [src/db/db-docs.html](src/db/db-docs.html), [src/renderer/renderer-docs.html](src/renderer/renderer-docs.html), and [src/shared/shared-docs.html](src/shared/shared-docs.html).
- The key visual explainer for the product's data flow, entity interaction, and slice creation is [docs/data-flow-entity-slice-map.html](docs/data-flow-entity-slice-map.html).

## Load-bearing architectural invariants

These are the rules every change must preserve — violating any of them breaks the product thesis:

- **Entities are truth; documents are a projection surface.** Documents hold prose only. Aliases, matching rules, slice boundaries, and annotations live as Entities, event-sourced. A full destructive re-paste of a document is safe because no metadata rides inside it.
- **No stored or precomputed matches.** Entity highlights are derived live from visible text via regex matching rules. Document structure (book/part/chapter) is also regex-derived, not tagged.
- **Event-sourced history.** Every mutation appends to the domain event log or the ProseMirror step log (or both) before projections update. Current-state tables (`documents`, `entities`, etc.) are projections and must be rebuildable from logs + checkpoints. MVP writes are append-then-project inside one SQLite transaction.
- **Shared `TextAnchor` substrate.** Slice boundaries and annotations share the same anchor payload shape and survive edits through ProseMirror `Mapping`. Anchors record `documentVersionSeen`; if mapping collapses a range, state becomes `invalid` rather than silently "healed."
- **Clean clipboard.** `Ctrl+A` / `Ctrl+C` must yield prose, not decorations or editor chrome. Derived highlights and annotation underlines live in ProseMirror `Decoration`, never in the document model.
- **Local-first, single-user.** No cloud, no collaboration, no CRDT, no merge. The author owns the file.

## Stack (decided, not provisional)

Electron + React + TypeScript + Vite + **ProseMirror** (locked by [ADR-005](docs/adr/adr-index.html#docs-adr-adr-005-editor-foundation-locked-to-prosemirror)) + SQLite. Pretext is an explicit exploratory option for long-document layout — not decided.

## Runtime boundaries (pre-declared in `src/`)

| Folder | Owns | Stay out of |
| --- | --- | --- |
| [src/main](src/main) | app lifecycle, filesystem, DB bootstrap, window policy, IPC registration | React state, editor internals |
| [src/preload](src/preload) | narrow typed bridge, validation | business logic, persistence policy |
| [src/renderer](src/renderer) | React UI, panels, editor host, feature composition | raw SQL, broad FS access |
| [src/shared](src/shared) | domain types, DTOs, contracts | platform-specific behavior |
| [src/db](src/db) | schema, event/step logs, checkpoints, projections, repositories, export | UI composition |

When a future pass writes code, it must land inside these boundaries. Don't create new top-level runtime folders without an ADR.

## Folder documentation convention

Every folder under `src/` and `docs/` must be represented in the matching consolidated HTML doc with a consistent shape: **Status / If you landed here first / Parent reads / Owns / Does not own / Key relationships / Decided / Open / Deferred** (plus occasionally Inputs and outputs, Likely future code here, Current ADRs, etc.). When you add a new folder, add or update that HTML section and refresh the Agent Context Index line ranges.

## File-size and decomposition rules

These are how we keep god files from re-forming. Full rationale and file-by-file targets live in [refineCode.html](refineCode.html); AI enforcement checklist lives in [AGENT.md](AGENT.md).

- **Soft limits:** React component 300 lines, custom hook 150, repository module 400, IPC/preload 150. Data-only shared type modules may exceed.
- **Hard limits (split before merge):** React component 500, custom hook 250, repository module 700, IPC/preload 250.
- **No new features in a file at or above its soft limit without first extracting.** If your change grows [src/renderer/App.tsx](src/renderer/App.tsx), [src/renderer/state/useEverlinkPlacement.ts](src/renderer/state/useEverlinkPlacement.ts), or any aggregate repository under [src/db/repositories/](src/db/repositories/) past its soft limit, extract first then modify the extracted home. Populate the folder the feature belongs in — [src/renderer/features/*](src/renderer/features/) or [src/db/repositories/](src/db/repositories/) — rather than appending to an existing large file.
- **Extraction is a no-behavior-change move.** One PR per section, verified by `npm run check`. Don't refactor and add a feature in the same commit.
- **ESLint enforces the runtime boundaries automatically** via `no-restricted-imports` in [eslint.config.mjs](eslint.config.mjs). If the linter blocks an import you wanted, the right fix is to move the code, not to silence the rule.

## Writing new docs

- New ADR, experiment, feature brief, or retrospective: start from [docs/templates/templates-index.html](docs/templates/templates-index.html), then add the new material as HTML.
- Feature briefs belong in [docs/docs-index.html](docs/docs-index.html) unless they grow large enough to deserve their own HTML file.
- Experiments belong in [docs/experiments/experiments-index.html](docs/experiments/experiments-index.html); keep active and resolved sections visually distinct.
- When you materially change a top-level `FOR_HUMAN_*` doc, prepend a dated entry to its "Last change" list. Use absolute dates, not relative ones.
- Avoid emoji in docs unless the user explicitly asks.

## Domain term discipline

[FOR_HUMAN_CODE--DOC.html](FOR_HUMAN_CODE--DOC.html) has a domain vocabulary table (`Project`, `DocumentFolder`, `Document`, `DocumentOutlineNode`, `Entity`, `MatchingRule`, `TextAnchor`, `Slice`, `SliceBoundary`, `EntitySlice`, `PendingEverlinkSession`, `AnchorResolutionResult`, `Panel`, `Annotation`, `EventStream`, `DocumentStep`, `DocumentCheckpoint`, `Projection`, …). When you discuss the system, use these names exactly. If you need a new concept, add it to that table rather than inventing a parallel term in another doc.
