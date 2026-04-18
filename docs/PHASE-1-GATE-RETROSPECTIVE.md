# Phase 1 Gate Retrospective

## Status
In progress

## Date
2026-04-17

## Why this exists
The proof workbench is now real enough that Phase 1 questions should be tracked as observed gates, not just planned experiments.
This note is the lightweight checkpoint between the original single-document harness and any future MVP claim.

## Passed enough to keep building
- Snapshot persistence through local SQLite now works on the `better-sqlite3` path with WAL mode and `synchronous=FULL`.
- The renderer has an explicit real-manuscript import slot, a persisted head reload path, and a clipboard audit path.
- The workbench can now record steps, checkpoints, events, and replay a historical document version.

## Implemented but still unproven at real-manuscript scale
- Shared anchor capture, mapping, fallback repair, and invalid or ambiguous states.
- Visible-range matching with literal, alias, and bounded-regex rules.
- Pretext comparison against the live editor surface.

## Not yet closed
- Real-manuscript findings for anchor behavior, matching behavior, and replay performance.
- Final clipboard confidence against the human-pasted Google Docs manuscript.
- A trustworthy decision on whether Pretext should be adopted, deferred, or rejected.

## Current rule
Phase 2 or MVP planning should still wait for one more adversarial pass plus real-manuscript testing inside the new workbench.
