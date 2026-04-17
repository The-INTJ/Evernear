# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current stage: Phase 0, documentation spine only

This repo is pre-code. There is no `package.json`, no build system, no tests, no lint config, and no runnable app yet. The `src/` tree is README-only scaffolding that pre-declares runtime boundaries before implementation lands (see [FOR_HUMAN_AND_AI_ROADMAP--DOC.md](FOR_HUMAN_AND_AI_ROADMAP--DOC.md) "Phase 0: Documentation spine").

Do not invent build, test, or install commands. If the user asks to run something, check whether the tooling actually exists first — if it doesn't, say so rather than fabricating a `npm test` that will fail.

## Doc hierarchy and contradiction rule

Read in this order when you land cold:

1. [Product_Guide.md](Product_Guide.md) — the north star. Deliberately short. **When it contradicts longer docs, the Product Guide wins.**
2. [FOR_HUMAN_BUSINESS--DOC.md](FOR_HUMAN_BUSINESS--DOC.md) — product strategy and positioning.
3. [FOR_HUMAN_CODE--DOC.md](FOR_HUMAN_CODE--DOC.md) — architecture, domain vocabulary, runtime boundaries. This is the canonical source for domain terms (`Entity`, `Slice`, `TextAnchor`, `DocumentStep`, etc.) — reuse them verbatim.
4. [FOR_HUMAN_AND_AI_ROADMAP--DOC.md](FOR_HUMAN_AND_AI_ROADMAP--DOC.md) — phased execution plan and load-bearing spikes.

Durable decisions: [docs/adr/](docs/adr/). Workflow-level decisions more specific than the north-star docs but not durable enough to be ADRs: top-level `FB-*` docs (e.g. [docs/FB-001-selection-driven-everlink.md](docs/FB-001-selection-driven-everlink.md)). Proof work: [docs/experiments/](docs/experiments/).

## Load-bearing architectural invariants

These are the rules every change must preserve — violating any of them breaks the product thesis:

- **Entities are truth; documents are a projection surface.** Documents hold prose only. Aliases, matching rules, slice boundaries, and annotations live as Entities, event-sourced. A full destructive re-paste of a document is safe because no metadata rides inside it.
- **No stored or precomputed matches.** Entity highlights are derived live from visible text via regex matching rules. Document structure (book/part/chapter) is also regex-derived, not tagged.
- **Event-sourced history.** Every mutation appends to the domain event log or the ProseMirror step log (or both) before projections update. Current-state tables (`documents`, `entities`, etc.) are projections and must be rebuildable from logs + checkpoints. MVP writes are append-then-project inside one SQLite transaction.
- **Shared `TextAnchor` substrate.** Slice boundaries and annotations share the same anchor payload shape and survive edits through ProseMirror `Mapping`. Anchors record `documentVersionSeen`; if mapping collapses a range, state becomes `invalid` rather than silently "healed."
- **Clean clipboard.** `Ctrl+A` / `Ctrl+C` must yield prose, not decorations or editor chrome. Derived highlights and annotation underlines live in ProseMirror `Decoration`, never in the document model.
- **Local-first, single-user.** No cloud, no collaboration, no CRDT, no merge. The author owns the file.

## Stack (decided, not provisional)

Electron + React + TypeScript + Vite + **ProseMirror** (locked by [ADR-005](docs/adr/ADR-005-editor-foundation-locked-to-prosemirror.md)) + SQLite. Pretext is an explicit exploratory option for long-document layout — not decided.

## Runtime boundaries (pre-declared in `src/`)

| Folder | Owns | Stay out of |
| --- | --- | --- |
| [src/main](src/main) | app lifecycle, filesystem, DB bootstrap, window policy, IPC registration | React state, editor internals |
| [src/preload](src/preload) | narrow typed bridge, validation | business logic, persistence policy |
| [src/renderer](src/renderer) | React UI, panels, editor host, feature composition | raw SQL, broad FS access |
| [src/shared](src/shared) | domain types, DTOs, contracts | platform-specific behavior |
| [src/db](src/db) | schema, event/step logs, checkpoints, projections, repositories, export | UI composition |

When a future pass writes code, it must land inside these boundaries. Don't create new top-level runtime folders without an ADR.

## Folder README convention

Every folder under `src/` and `docs/` has a README following a consistent shape: **Status / If you landed here first / Parent reads / Owns / Does not own / Key relationships / Decided / Open / Deferred** (plus occasionally Inputs and outputs, Likely future code here, Current ADRs, etc.). When you add a new folder, follow this shape — it's the repo's chain-up rule for keeping docs discoverable.

## Writing new docs

- New ADR, experiment, feature brief, or retrospective: start from [docs/templates/](docs/templates/).
- Feature briefs go at the top of `docs/` as `FB-NNN-short-slug.md` (see [FB-001](docs/FB-001-selection-driven-everlink.md)).
- Experiments go in [docs/experiments/](docs/experiments/) as `EXP-NNN-slug.md`; move to `resolved/` once they've answered their question (see EXP-003, EXP-004).
- When you materially change a top-level `FOR_HUMAN_*` doc, prepend a dated entry to its "Last change" list. Use absolute dates, not relative ones.
- Avoid emoji in docs unless the user explicitly asks.

## Domain term discipline

[FOR_HUMAN_CODE--DOC.md](FOR_HUMAN_CODE--DOC.md) has a domain vocabulary table (`Project`, `DocumentFolder`, `Document`, `DocumentOutlineNode`, `Entity`, `MatchingRule`, `TextAnchor`, `Slice`, `SliceBoundary`, `EntitySlice`, `PendingEverlinkSession`, `AnchorResolutionResult`, `Panel`, `Annotation`, `EventStream`, `DocumentStep`, `DocumentCheckpoint`, `Projection`, …). When you discuss the system, use these names exactly. If you need a new concept, add it to that table rather than inventing a parallel term in a README.
