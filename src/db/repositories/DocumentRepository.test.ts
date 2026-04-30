// Document-aggregate event-log discipline. These tests exist to keep R2
// honest: every mutation that changes a row must append exactly one event
// inside the same transaction, so a replay from the log can reconstruct
// the projection.
//
// Coverage by mutation:
//   - createDocument            → documentCreated event + initial checkpoint
//   - updateDocumentMeta        → documentMetaUpdated event with title/folderId
//   - deleteDocument            → documentDeleted event + slice-id cascade list
//   - reorderDocument           → documentReordered event with both swap sides
//   - applyDocumentTransaction  → N step rows + checkpoint on saveIntent

import path from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { SqliteHarness } from "../sqliteHarness";
import { WorkspaceRepository } from "./WorkspaceRepository";

let tempDir: string;
let repository: WorkspaceRepository;
let harness: SqliteHarness;

beforeEach(() => {
  tempDir = mkdtempSync(path.join(tmpdir(), "evernear-document-repo-test-"));
  const dbPath = path.join(tempDir, "phase-1.sqlite");
  harness = SqliteHarness.open(dbPath, "NORMAL");
  repository = new WorkspaceRepository(harness);
});

afterEach(() => {
  harness.close();
  rmSync(tempDir, { recursive: true, force: true });
});

describe("DocumentRepository.createDocument", () => {
  it("appends exactly one documentCreated event with the title and folderId payload", () => {
    const state = repository.ensureWorkspaceState();
    const projectId = state.layout.activeProjectId!;
    const folderId = state.folders[0]!.id;

    const before = countEvents(harness, "document", "documentCreated");
    const after = repository.createDocument({ projectId, folderId, title: "Scene 7" });
    const afterCount = countEvents(harness, "document", "documentCreated");

    expect(afterCount).toBe(before + 1);
    const created = after.documents.find((d) => d.title === "Scene 7")!;
    expect(created).toBeDefined();
    expect(created.folderId).toBe(folderId);

    const payload = latestEventPayload(harness, "document", "documentCreated");
    expect(payload.title).toBe("Scene 7");
    expect(payload.folderId).toBe(folderId);

    // R3 invariant: a checkpoint at version 0 must exist for replay to
    // start from somewhere when the user later emits steps.
    const checkpoints = harness.getConnection()
      .prepare("SELECT version FROM document_checkpoints WHERE document_id = ?")
      .all(created.id) as Array<{ version: number }>;
    expect(checkpoints.some((c) => c.version === 0)).toBe(true);
  });

  it("normalises an empty/whitespace title to 'Untitled Document' in both row and event", () => {
    const state = repository.ensureWorkspaceState();
    const projectId = state.layout.activeProjectId!;
    const folderId = state.folders[0]!.id;

    const after = repository.createDocument({ projectId, folderId, title: "   " });
    const created = [...after.documents]
      .filter((d) => d.folderId === folderId)
      .sort((left, right) => right.ordering - left.ordering)[0]!;

    expect(created.title).toBe("Untitled Document");
    const payload = latestEventPayload(harness, "document", "documentCreated");
    expect(payload.title).toBe("Untitled Document");
  });
});

describe("DocumentRepository.updateDocumentMeta", () => {
  it("appends one documentMetaUpdated event with the new title and folderId", () => {
    const state = repository.ensureWorkspaceState();
    const projectId = state.layout.activeProjectId!;
    const folderId = state.folders[0]!.id;

    const created = repository.createDocument({ projectId, folderId, title: "Working title" });
    const docId = created.documents.find((d) => d.title === "Working title")!.id;

    const before = countEvents(harness, "document", "documentMetaUpdated");
    repository.updateDocumentMeta({ documentId: docId, title: "Final title" });
    const after = countEvents(harness, "document", "documentMetaUpdated");

    expect(after).toBe(before + 1);
    const payload = latestEventPayload(harness, "document", "documentMetaUpdated");
    expect(payload.title).toBe("Final title");
    expect(payload.folderId).toBe(folderId);

    const reloaded = repository.loadWorkspace().documents.find((d) => d.id === docId)!;
    expect(reloaded.title).toBe("Final title");
  });

  it("re-orders the document into the destination folder when folderId changes", () => {
    const state = repository.ensureWorkspaceState();
    const projectId = state.layout.activeProjectId!;
    const sourceFolderId = state.folders[0]!.id;

    // Create a sibling folder so we have somewhere to move the doc.
    const withFolder = repository.createFolder({ projectId, title: "Outline" });
    const destFolderId = withFolder.folders.find((f) => f.title === "Outline")!.id;

    const created = repository.createDocument({
      projectId,
      folderId: sourceFolderId,
      title: "Mover",
    });
    const docId = created.documents.find((d) => d.title === "Mover")!.id;

    repository.updateDocumentMeta({ documentId: docId, folderId: destFolderId });

    const reloaded = repository.loadWorkspace().documents.find((d) => d.id === docId)!;
    expect(reloaded.folderId).toBe(destFolderId);

    const payload = latestEventPayload(harness, "document", "documentMetaUpdated");
    expect(payload.folderId).toBe(destFolderId);
  });
});

describe("DocumentRepository.deleteDocument", () => {
  it("appends one documentDeleted event with the prior title", () => {
    const state = repository.ensureWorkspaceState();
    const projectId = state.layout.activeProjectId!;
    const folderId = state.folders[0]!.id;

    const created = repository.createDocument({ projectId, folderId, title: "To go" });
    const docId = created.documents.find((d) => d.title === "To go")!.id;

    const before = countEvents(harness, "document", "documentDeleted");
    repository.deleteDocument({ documentId: docId });
    const after = countEvents(harness, "document", "documentDeleted");

    expect(after).toBe(before + 1);
    const payload = latestEventPayload(harness, "document", "documentDeleted");
    expect(payload.title).toBe("To go");

    // The history rows must be cleaned up — deleteDocumentHistory runs
    // inside the same outer transaction.
    const remainingSteps = harness.getConnection()
      .prepare("SELECT COUNT(*) AS count FROM document_steps WHERE document_id = ?")
      .get(docId) as { count: number };
    expect(remainingSteps.count).toBe(0);
    const remainingCheckpoints = harness.getConnection()
      .prepare("SELECT COUNT(*) AS count FROM document_checkpoints WHERE document_id = ?")
      .get(docId) as { count: number };
    expect(remainingCheckpoints.count).toBe(0);
  });

  it("returns the slice-id cascade list so the facade can fan out slice deletes", () => {
    // Drive the cascade through the WorkspaceRepository facade since that's
    // where the cross-aggregate transaction lives. The DocumentRepository
    // delete returns the slice IDs; the facade is what calls deleteSlice.
    const state = repository.ensureWorkspaceState();
    const projectId = state.layout.activeProjectId!;
    const folderId = state.folders[0]!.id;

    const created = repository.createDocument({ projectId, folderId, title: "Has slices" });
    const documentId = created.documents.find((d) => d.title === "Has slices")!.id;

    const entityCreated = repository.createEntity({ projectId, name: "Cascade target" });
    const entityId = entityCreated.layout.selectedEntityId!;

    const sliceCreated = repository.createSlice({
      projectId,
      entityId,
      documentId,
      title: "Slice 1",
      anchor: {
        documentId,
        from: 1,
        to: 1,
        exact: "",
        prefix: "",
        suffix: "",
        blockPath: [0],
        versionSeen: 0,
      },
    });
    const sliceId = sliceCreated.slices.find((s) => s.documentId === documentId)!.id;

    repository.deleteDocument({ documentId });

    const afterDelete = repository.loadWorkspace();
    expect(afterDelete.slices.some((s) => s.id === sliceId)).toBe(false);
    expect(afterDelete.sliceBoundaries.some((b) => b.sliceId === sliceId)).toBe(false);
  });
});

describe("DocumentRepository.applyDocumentTransaction", () => {
  it("appends N step rows for N steps and advances the document version", () => {
    const state = repository.ensureWorkspaceState();
    const documentId = state.activeDocument!.id;
    const baseVersion = state.activeDocument!.currentVersion;

    const stepsBefore = countDocumentSteps(harness, documentId);
    repository.applyDocumentTransaction({
      documentId,
      baseVersion,
      title: state.activeDocument!.title,
      steps: [{ stepType: "test-1" }, { stepType: "test-2" }, { stepType: "test-3" }],
      inverseSteps: [{ stepType: "inv-1" }, { stepType: "inv-2" }, { stepType: "inv-3" }],
      contentJson: { type: "doc", content: [{ type: "paragraph" }] },
      plainText: "",
    });
    const stepsAfter = countDocumentSteps(harness, documentId);
    expect(stepsAfter - stepsBefore).toBe(3);

    const reloaded = repository.loadWorkspace();
    const versionRow = harness.getConnection()
      .prepare("SELECT current_version AS version FROM documents WHERE id = ?")
      .get(documentId) as { version: number };
    expect(versionRow.version).toBe(baseVersion + 3);
    expect(reloaded.documents.some((d) => d.id === documentId)).toBe(true);

    // Each row's version must increment monotonically from baseVersion + 1.
    const rows = harness.getConnection()
      .prepare(`
        SELECT version
        FROM document_steps
        WHERE document_id = ?
        ORDER BY version ASC
      `)
      .all(documentId) as Array<{ version: number }>;
    const tail = rows.slice(rows.length - 3);
    expect(tail.map((r) => r.version)).toEqual([baseVersion + 1, baseVersion + 2, baseVersion + 3]);
  });

  it("writes a checkpoint when saveIntent is true", () => {
    const state = repository.ensureWorkspaceState();
    const documentId = state.activeDocument!.id;
    const baseVersion = state.activeDocument!.currentVersion;

    const checkpointsBefore = countCheckpoints(harness, documentId);
    repository.applyDocumentTransaction({
      documentId,
      baseVersion,
      title: state.activeDocument!.title,
      steps: [{ stepType: "save-step" }],
      inverseSteps: [{ stepType: "inv-save-step" }],
      contentJson: { type: "doc", content: [{ type: "paragraph" }] },
      plainText: "",
      saveIntent: true,
    });
    const checkpointsAfter = countCheckpoints(harness, documentId);

    // INSERT OR REPLACE means the same (document_id, version) row is
    // overwritten, but a new version means a new checkpoint row.
    expect(checkpointsAfter).toBeGreaterThan(checkpointsBefore);
    const latest = harness.getConnection()
      .prepare(`
        SELECT version, label
        FROM document_checkpoints
        WHERE document_id = ?
        ORDER BY version DESC
        LIMIT 1
      `)
      .get(documentId) as { version: number; label: string };
    expect(latest.version).toBe(baseVersion + 1);
    expect(latest.label).toBe("explicit-save");
  });

  it("does not write a checkpoint when saveIntent is omitted and the version is below the auto cadence", () => {
    const state = repository.ensureWorkspaceState();
    const documentId = state.activeDocument!.id;
    const baseVersion = state.activeDocument!.currentVersion;

    const checkpointsBefore = countCheckpoints(harness, documentId);
    repository.applyDocumentTransaction({
      documentId,
      baseVersion,
      title: state.activeDocument!.title,
      steps: [{ stepType: "noisy-step" }],
      inverseSteps: [{ stepType: "inv-noisy" }],
      contentJson: { type: "doc", content: [{ type: "paragraph" }] },
      plainText: "",
    });
    const checkpointsAfter = countCheckpoints(harness, documentId);

    // The seed checkpoint at v0 stays; no new row at v1.
    expect(checkpointsAfter).toBe(checkpointsBefore);
  });

  it("throws when baseVersion does not match the persisted currentVersion", () => {
    const state = repository.ensureWorkspaceState();
    const documentId = state.activeDocument!.id;
    const baseVersion = state.activeDocument!.currentVersion;

    expect(() => repository.applyDocumentTransaction({
      documentId,
      baseVersion: baseVersion + 5,
      title: state.activeDocument!.title,
      steps: [{ stepType: "stale" }],
      inverseSteps: [{ stepType: "inv-stale" }],
      contentJson: { type: "doc", content: [{ type: "paragraph" }] },
      plainText: "",
    })).toThrow(/Version mismatch/);
  });
});

describe("DocumentRepository.reorderDocument", () => {
  it("swaps neighboring orderings and appends one documentReordered event", () => {
    const state = repository.ensureWorkspaceState();
    const projectId = state.layout.activeProjectId!;
    const folderId = state.folders[0]!.id;

    // Start from a single seeded document; create two more so we have
    // siblings to reorder.
    repository.createDocument({ projectId, folderId, title: "A" });
    const afterB = repository.createDocument({ projectId, folderId, title: "B" });

    const before = afterB.documents.filter((d) => d.folderId === folderId);
    expect(before.length).toBeGreaterThanOrEqual(2);

    // Pick the last two siblings (highest orderings) so we can swap them
    // without depending on the seed document's position.
    const sorted = [...before].sort((left, right) => left.ordering - right.ordering);
    const upper = sorted[sorted.length - 1]!;
    const lower = sorted[sorted.length - 2]!;

    const reorderEventsBefore = countEvents(harness, "document", "documentReordered");

    repository.reorderDocument({ documentId: upper.id, direction: "up" });

    const after = repository.loadWorkspace().documents;
    const upperAfter = after.find((d) => d.id === upper.id)!;
    const lowerAfter = after.find((d) => d.id === lower.id)!;
    expect(upperAfter.ordering).toBe(lower.ordering);
    expect(lowerAfter.ordering).toBe(upper.ordering);

    const reorderEventsAfter = countEvents(harness, "document", "documentReordered");
    expect(reorderEventsAfter).toBe(reorderEventsBefore + 1);

    const payload = latestEventPayload(harness, "document", "documentReordered");
    expect(payload.documentId).toBe(upper.id);
    expect(payload.swapDocumentId).toBe(lower.id);
    expect(payload.fromOrdering).toBe(upper.ordering);
    expect(payload.toOrdering).toBe(lower.ordering);
    expect(payload.swapFromOrdering).toBe(lower.ordering);
    expect(payload.swapToOrdering).toBe(upper.ordering);
  });

  it("is a no-op (no event) when the document is already at the boundary", () => {
    const state = repository.ensureWorkspaceState();
    const projectId = state.layout.activeProjectId!;
    const folderId = state.folders[0]!.id;

    const afterCreate = repository.createDocument({ projectId, folderId, title: "Solo" });
    const sorted = [...afterCreate.documents]
      .filter((d) => d.folderId === folderId)
      .sort((left, right) => left.ordering - right.ordering);
    const first = sorted[0]!;

    const reorderEventsBefore = countEvents(harness, "document", "documentReordered");
    repository.reorderDocument({ documentId: first.id, direction: "up" });
    const reorderEventsAfter = countEvents(harness, "document", "documentReordered");

    // Direction "up" on the first sibling has no swap target, so no event
    // should be appended — replays would otherwise see a phantom reorder.
    expect(reorderEventsAfter).toBe(reorderEventsBefore);
  });
});

describe("DocumentRepository.moveDocument", () => {
  it("appends one documentMoved event when moving across folders", () => {
    const state = repository.ensureWorkspaceState();
    const projectId = state.layout.activeProjectId!;
    const sourceFolder = state.folders[0]!;
    const targetState = repository.createFolder({
      projectId,
      title: "Target",
      parentFolderId: null,
    });
    const targetFolder = targetState.folders.find((f) => f.title === "Target")!;
    const created = repository.createDocument({
      projectId,
      folderId: sourceFolder.id,
      title: "Mover",
    });
    const docId = created.documents.find((d) => d.title === "Mover")!.id;

    const before = countEvents(harness, "document", "documentMoved");
    repository.moveDocument({
      documentId: docId,
      newFolderId: targetFolder.id,
      beforeDocumentId: null,
    });
    const after = countEvents(harness, "document", "documentMoved");

    expect(after).toBe(before + 1);
    const payload = latestEventPayload(harness, "document", "documentMoved");
    expect(payload.fromFolderId).toBe(sourceFolder.id);
    expect(payload.toFolderId).toBe(targetFolder.id);

    const reloaded = repository.loadWorkspace().documents.find((d) => d.id === docId)!;
    expect(reloaded.folderId).toBe(targetFolder.id);
  });

  it("computes a midpoint ordering when inserting between two siblings", () => {
    const state = repository.ensureWorkspaceState();
    const projectId = state.layout.activeProjectId!;
    const folderId = state.folders[0]!.id;

    repository.createDocument({ projectId, folderId, title: "Alpha" });
    repository.createDocument({ projectId, folderId, title: "Bravo" });
    const after = repository.createDocument({ projectId, folderId, title: "Charlie" });

    const docs = after.documents.filter((d) => d.folderId === folderId).sort(
      (left, right) => left.ordering - right.ordering,
    );
    const first = docs[0]!;
    const last = docs[docs.length - 1]!;
    const middle = docs[1]!;

    repository.moveDocument({
      documentId: last.id,
      newFolderId: folderId,
      beforeDocumentId: middle.id,
    });

    const reloaded = repository.loadWorkspace().documents
      .filter((d) => d.folderId === folderId)
      .sort((left, right) => left.ordering - right.ordering);
    const lastIndex = reloaded.findIndex((d) => d.id === last.id);
    const firstIndex = reloaded.findIndex((d) => d.id === first.id);
    const middleIndex = reloaded.findIndex((d) => d.id === middle.id);
    expect(lastIndex).toBeLessThan(middleIndex);
    expect(lastIndex).toBeGreaterThan(firstIndex);
  });

  it("recompacts and re-inserts when neighbor gap is too small", () => {
    const state = repository.ensureWorkspaceState();
    const projectId = state.layout.activeProjectId!;
    const folderId = state.folders[0]!.id;

    repository.createDocument({ projectId, folderId, title: "A" });
    repository.createDocument({ projectId, folderId, title: "B" });
    const after = repository.createDocument({ projectId, folderId, title: "C" });

    const docs = after.documents.filter((d) => d.folderId === folderId).sort(
      (left, right) => left.ordering - right.ordering,
    );
    const a = docs[0]!;
    const b = docs[1]!;

    // Force a tight gap by collapsing two siblings to consecutive integers.
    harness.getConnection().prepare("UPDATE documents SET ordering = ? WHERE id = ?")
      .run(10, a.id);
    harness.getConnection().prepare("UPDATE documents SET ordering = ? WHERE id = ?")
      .run(11, b.id);

    const c = docs[2]!;
    repository.moveDocument({
      documentId: c.id,
      newFolderId: folderId,
      beforeDocumentId: b.id,
    });

    const reloaded = repository.loadWorkspace().documents
      .filter((d) => d.folderId === folderId)
      .sort((left, right) => left.ordering - right.ordering);
    const order = reloaded.map((d) => d.id);
    expect(order.indexOf(c.id)).toBeGreaterThan(order.indexOf(a.id));
    expect(order.indexOf(c.id)).toBeLessThan(order.indexOf(b.id));
  });
});

function countDocumentSteps(h: SqliteHarness, documentId: string): number {
  const row = h.getConnection()
    .prepare("SELECT COUNT(*) AS count FROM document_steps WHERE document_id = ?")
    .get(documentId) as { count: number };
  return row.count;
}

function countCheckpoints(h: SqliteHarness, documentId: string): number {
  const row = h.getConnection()
    .prepare("SELECT COUNT(*) AS count FROM document_checkpoints WHERE document_id = ?")
    .get(documentId) as { count: number };
  return row.count;
}

function countEvents(h: SqliteHarness, aggregate: string, eventType: string): number {
  const row = h.getConnection()
    .prepare(`
      SELECT COUNT(*) AS count
      FROM events
      WHERE aggregate_type = ? AND event_type = ?
    `)
    .get(aggregate, eventType) as { count: number };
  return row.count;
}

function latestEventPayload(h: SqliteHarness, aggregate: string, eventType: string): Record<string, unknown> {
  const row = h.getConnection()
    .prepare(`
      SELECT payload_json
      FROM events
      WHERE aggregate_type = ? AND event_type = ?
      ORDER BY id DESC
      LIMIT 1
    `)
    .get(aggregate, eventType) as { payload_json: string } | undefined;
  if (!row) {
    throw new Error(`No ${eventType} event found for aggregate ${aggregate}`);
  }
  return JSON.parse(row.payload_json) as Record<string, unknown>;
}
