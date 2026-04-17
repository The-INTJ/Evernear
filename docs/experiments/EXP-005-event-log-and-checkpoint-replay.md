# EXP-005: Event Log and Checkpoint Replay

## Status
Planned

## Date
2026-04-17

## Parent reads
- [FOR_HUMAN_AND_AI_ROADMAP--DOC.md](../../FOR_HUMAN_AND_AI_ROADMAP--DOC.md)
- [FOR_HUMAN_CODE--DOC.md](../../FOR_HUMAN_CODE--DOC.md)
- [ADR-006](../adr/ADR-006-event-sourced-document-and-metadata-history.md)
- [src/db/README.md](../../src/db/README.md)

## Question
Can the event-sourced history layer carry real writing sessions without making normal saves feel slow, normal opens feel slow, or projections drift from the logs?

## Why this is load-bearing
If the log and projection model is fragile in any of these dimensions, the whole history subsystem either never ships or silently corrupts. Every downstream promise — time travel, named checkpoints, restore, history-preserving export — depends on this substrate being boring and trustworthy.

## Working hypothesis
- A single SQLite transaction per mutation — log append plus projection update — is fast enough at typing pace.
- Nearest-checkpoint plus forward Step replay opens a document inside an acceptable budget on realistic prose sizes.
- A periodic or save-triggered checkpoint policy bounds open cost without bloating the database unacceptably.
- Projection rebuild from logs plus checkpoints produces identical current-state to the live-maintained tables.

## Proposed schema sketch
```ts
type EventRow = {
  id: string;
  stream: string;
  aggregateId: string;
  seq: number;
  type: string;
  payload: string; // JSON
  createdAt: string;
};

type DocumentStepRow = {
  id: string;
  documentId: string;
  version: number;
  stepJson: string;
  inverseJson: string;
  createdAt: string;
};

type DocumentCheckpointRow = {
  documentId: string;
  version: number;
  contentFormat: string;
  contentSchemaVersion: number;
  contentJson: string;
  plainText: string;
  label: string | null;
  createdAt: string;
};
```

## Pseudo-code sketch
```ts
function commitDocumentTransaction(tr: Transaction, prior: EditorState) {
  const next = prior.apply(tr);
  db.transaction(() => {
    for (const step of tr.steps) {
      appendDocumentStep(next.doc, step);
    }
    updateDocumentProjection(next.doc);
    if (shouldCheckpoint(next)) {
      writeCheckpoint(next.doc);
    }
  });
  return next;
}

function openDocumentAtVersion(documentId: string, version: number): EditorState {
  const base = loadNearestCheckpoint(documentId, version);
  const steps = loadStepsBetween(documentId, base.version, version);
  return replaySteps(base, steps);
}
```

## Spike plan
- Build a standalone harness with ProseMirror and SQLite.
- Simulate a writing session with tens of thousands of small edits and a few large structural edits.
- Measure per-save latency, head-of-history document-open latency, and document-open latency at an arbitrary historical version.
- Destroy the projection tables and rebuild them from logs plus checkpoints; compare row-for-row against a live-maintained baseline.
- Exercise boundary and annotation mapping across the whole session and verify that time-travel positions land where the historical text says they should.

## Acceptance criteria
- Typing-pace saves stay imperceptible in practice.
- Head-of-history open is not noticeably slower than loading a raw snapshot.
- Opening a historical version within normal session distance is acceptable.
- Rebuilt projections match live projections exactly.
- Boundary and annotation time travel land at positions that are obviously correct given the historical text.

## Notes for later pass
- If checkpoints must land much more often than explicit save events to keep open fast, record that so ADR-006's cadence open question can close.
- If projection rebuild drifts from live tables even once, treat it as a correctness bug and fix the log path before shipping.
- EXP-001 anchor healing and this experiment share the same mapping substrate; failures in either are signals for the other.
