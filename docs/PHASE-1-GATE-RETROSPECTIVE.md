# Phase 1 Gate Retrospective

## Status
In progress — foundation hardened (Phase 1.5 landed 2026-04-18), real-manuscript proof still pending

## Date
2026-04-17, updated 2026-04-19

## Why this exists
The proof workbench is real enough that Phase 1 questions should be tracked as observed gates, not just planned experiments.
This note is the lightweight checkpoint between the original single-document harness and any future Phase 2+ claim.

## Passed enough to keep building
- Snapshot persistence through local SQLite works on the `better-sqlite3` path with WAL mode and `synchronous=FULL`.
- The renderer has an explicit real-manuscript import slot, a persisted head reload path, and a clipboard audit path.
- The workbench records steps, checkpoints, events, and replays historical document versions.
- Shared `TextAnchor` substrate exists in [src/shared/anchoring.ts](../src/shared/anchoring.ts), used by both DB (boundary repair) and renderer (selection → anchor). Covered by a dedicated test suite; the `walkNodeText` off-by-one from the pre-split code has been fixed.
- Foundation hardened in Phase 1.5: god files split (App.tsx 1,865 → 354; workbenchRepository.ts 2,188 → 0 replaced by per-aggregate repos), schema migration framework, typed event catalog, Zod at IPC boundary, Vitest suite covering load-bearing paths. See [PHASE-1.5-FOUNDATION-HARDENING.md](PHASE-1.5-FOUNDATION-HARDENING.md).

## Implemented but still unproven at real-manuscript scale
- Shared anchor capture, mapping, fallback repair, and invalid or ambiguous states.
- Visible-range matching with literal, alias, and bounded-regex rules.
- Pretext comparison against the live editor surface.
- Replay-to-version and projection-rebuild parity under sustained writing sessions.

## Not yet closed
- Real-manuscript findings for anchor behavior, matching behavior, and replay performance on the 50k+ word fixture.
- Final clipboard confidence against the human-pasted Google Docs manuscript.
- A trustworthy decision on whether Pretext should be adopted, deferred, or rejected (EXP-006 still "In progress").

## Current rule
The foundation is now clean enough to build new features on, but Phase 1's load-bearing proof claims (EXP-001, 002, 005, 006) still need the adversarial pass on a real 50k+ word manuscript before they can be marked Resolved. Human delegation required — the AI should not drive the large-fixture paste itself.
