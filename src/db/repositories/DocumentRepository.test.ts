// Document-aggregate event-log discipline. These tests exist to keep R2
// honest: every mutation that changes a row must append exactly one event
// inside the same transaction, so a replay from the log can reconstruct
// the projection.
//
// Today this file covers reorderDocument (the one mutation that historically
// shipped without an event append). Per Tier 3.1 of the foundation plan,
// the rest of the document mutations (createDocument, updateDocumentMeta,
// deleteDocument, applyDocumentTransaction) get folded in here when their
// PR lands.

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
