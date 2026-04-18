# EXP-005: Event Log and Checkpoint Replay

## Status
In progress

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
If the log and projection model is fragile in any of these dimensions, the whole history subsystem either never ships or silently corrupts. Every downstream promise - time travel, restore, named checkpoints, and history-preserving export - depends on this substrate being boring and trustworthy.

## Working hypothesis
- A single SQLite transaction per mutation - log append plus projection update - is fast enough at typing pace.
- Nearest-checkpoint plus forward `Step` replay opens a document inside an acceptable budget on realistic prose sizes.
- Explicit save plus periodic checkpointing, starting around every 200 steps, bounds open cost without bloating the database unacceptably.
- Projection rebuild from logs plus checkpoints produces identical current-state to the live-maintained tables.
- Anchor replay that starts from the latest anchor event at or before a target version and then maps forward stays honest enough for boundary and annotation history.

## MVP row envelopes
```ts
type EventRow = {
  id: string;
  aggregateType: string;
  aggregateId: string;
  aggregateSeq: number;
  eventType: string;
  eventVersion: number;
  payloadJson: string;
  createdAt: string;
};

type DocumentStepRow = {
  id: string;
  documentId: string;
  version: number;
  stepJson: string;
  inverseStepJson: string;
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

`documents` is not a checkpoint table. It stays the head current-state projection for a document. `document_checkpoints` stores historical replay bases.

## MVP repository and projection seams
- `appendDomainEvents(events)`
- `appendDocumentSteps(documentId, baseVersion, steps, inverses)`
- `loadNearestCheckpoint(documentId, targetVersion)`
- `replayDocumentToVersion(documentId, targetVersion)`
- `rebuildProjectionsFromHistory()`

All of these run on the same inline write path for MVP. Async projection maintenance is out of scope for this experiment.

## Pseudo-code sketch
```ts
function commitMutation(input: MutationInput) {
  db.transaction(() => {
    const domainEvents = deriveDomainEvents(input);
    const documentSteps = deriveDocumentSteps(input);

    appendDomainEvents(domainEvents);
    appendDocumentSteps(input.documentId, input.baseVersion, documentSteps.steps, documentSteps.inverses);
    projectCurrentState(domainEvents, documentSteps);

    if (shouldCheckpoint(input.saveIntent, documentSteps.nextVersion)) {
      writeDocumentCheckpoint(input.documentId, documentSteps.nextVersion);
    }
  });
}

function replayDocumentToVersion(documentId: string, targetVersion: number): EditorState {
  const checkpoint = loadNearestCheckpoint(documentId, targetVersion);
  const steps = loadStepsAfterVersion(documentId, checkpoint.version, targetVersion);
  return replaySteps(checkpoint, steps);
}

function resolveAnchorAtVersion(anchorEvents: AnchorEvent[], targetVersion: number): ResolvedAnchor {
  const seed = latestAnchorEventAtOrBefore(anchorEvents, targetVersion);
  const steps = loadStepsAfterVersion(seed.documentId, seed.documentVersionSeen, targetVersion);
  const mapped = mapAnchorForward(seed.anchor, steps);

  return mapped.isDeletedOrCollapsed
    ? { status: "invalid", anchor: seed.anchor }
    : { status: "resolved", anchor: mapped.anchor };
}
```

## Spike plan
- Build a standalone harness with ProseMirror and SQLite.
- Simulate a writing session with tens of thousands of small edits and a few large structural edits.
- Measure per-save latency, head-of-history document-open latency, and document-open latency at an arbitrary historical version.
- Destroy the projection tables and rebuild them from logs plus checkpoints; compare row-for-row against a live-maintained baseline.
- Exercise boundary and annotation mapping across the whole session and verify that time-travel positions land where the historical text says they should.
- Include deletion cases where mapped anchor ranges collapse or disappear and verify they become invalid rather than being silently healed to a misleading range.

## Acceptance criteria
- Typing-pace saves stay imperceptible in practice.
- Head-of-history open is not noticeably slower than loading a raw snapshot.
- Opening a historical version within normal session distance is acceptable.
- Rebuilt projections match live projections exactly.
- Boundary and annotation time travel land at positions that are obviously correct given the historical text.
- Deleted or collapsed anchor ranges are surfaced as invalid state consistently in both live projections and replay.

## Notes for later pass
- If checkpoints must land much more often than every explicit save plus roughly 200 steps to keep open fast, record that so ADR-006's cadence question can close.
- If projection rebuild drifts from live tables even once, treat it as a correctness bug and fix the log path before shipping.
- EXP-001 anchor healing and this experiment share the same mapping substrate; failures in either are signals for the other.

## Current workbench implementation
- The workbench now persists `documents`, `document_steps`, `document_checkpoints`, `events`, `anchor_probes`, `matching_rules`, and benchmark records in one local SQLite database.
- Document mutations append ProseMirror steps and update the head in the same synchronous path.
- Explicit checkpoint writes and periodic checkpointing at roughly every 200 steps are implemented.
- Replay-to-version and projection-rebuild parity checks are exposed directly in the UI.
- Historical anchor replay is implemented by loading the latest anchor event at or before the target version and mapping forward through the subsequent steps.

## Still to learn
- How the current synchronous path behaves under a much longer real writing session.
- Whether checkpoint cadence needs to move once the real manuscript and heavier edit sessions are exercised.
