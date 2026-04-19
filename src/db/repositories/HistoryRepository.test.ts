// Replay discipline. R3 says current-state tables are projections that
// must be reconstructable from the event log + ProseMirror step log
// (anchored against checkpoints). These tests exercise that property
// directly: emit real PM steps through the repository, drop the
// projection's content_json onto the floor, and verify replay rebuilds
// the same document the projection had.
//
// Two scenarios:
//   - linear replay: checkpoint at v0, N steps, replay(v=N) ↔ persisted
//     snapshot contentJson.
//   - mid-sequence checkpoint: write an explicit checkpoint partway
//     through, then replay from a later version. The replay must pick
//     the latest checkpoint ≤ targetVersion, not the v0 one, and apply
//     only the steps after that checkpoint.

import path from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

import { EditorState } from "prosemirror-state";
import { Node as ProseMirrorNode } from "prosemirror-model";
import { schema as basicSchema } from "prosemirror-schema-basic";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { JsonObject } from "../../shared/domain/document";
import { SqliteHarness } from "../sqliteHarness";
import { HistoryRepository } from "./HistoryRepository";
import { WorkspaceRepository } from "./WorkspaceRepository";

let tempDir: string;
let harness: SqliteHarness;
let workspace: WorkspaceRepository;
let history: HistoryRepository;

beforeEach(() => {
  tempDir = mkdtempSync(path.join(tmpdir(), "evernear-history-repo-test-"));
  const dbPath = path.join(tempDir, "phase-1.sqlite");
  harness = SqliteHarness.open(dbPath, "NORMAL");
  workspace = new WorkspaceRepository(harness);
  history = new HistoryRepository(harness);
});

afterEach(() => {
  harness.close();
  rmSync(tempDir, { recursive: true, force: true });
});

describe("HistoryRepository.replayDocumentToVersion", () => {
  it("rebuilds the projection's contentJson from a v0 checkpoint + step log", () => {
    const state = workspace.ensureWorkspaceState();
    const documentId = state.activeDocument!.id;

    // Build two real PM transactions that insert text. Capture both their
    // forward steps (for the log) and the post-state contentJson + plainText
    // (so the persisted projection matches what the editor would have).
    const editorStart = EditorState.create({
      schema: basicSchema,
      doc: basicSchema.nodeFromJSON(state.activeDocument!.contentJson),
    });
    const txA = editorStart.tr.insertText("Hello", 1);
    const stateAfterA = editorStart.apply(txA);
    const txB = stateAfterA.tr.insertText(" world", txA.selection.to);
    const stateAfterB = stateAfterA.apply(txB);

    const stepsA = txA.steps.map((s) => s.toJSON() as JsonObject);
    const inverseStepsA = txA.steps.map((s, i) =>
      s.invert(txA.docs[i]!).toJSON() as JsonObject);

    workspace.applyDocumentTransaction({
      documentId,
      baseVersion: state.activeDocument!.currentVersion,
      title: state.activeDocument!.title,
      steps: stepsA,
      inverseSteps: inverseStepsA,
      contentJson: stateAfterA.doc.toJSON() as JsonObject,
      plainText: stateAfterA.doc.textContent,
    });

    const midVersion = state.activeDocument!.currentVersion + stepsA.length;
    const stepsB = txB.steps.map((s) => s.toJSON() as JsonObject);
    const inverseStepsB = txB.steps.map((s, i) =>
      s.invert(txB.docs[i]!).toJSON() as JsonObject);

    workspace.applyDocumentTransaction({
      documentId,
      baseVersion: midVersion,
      title: state.activeDocument!.title,
      steps: stepsB,
      inverseSteps: inverseStepsB,
      contentJson: stateAfterB.doc.toJSON() as JsonObject,
      plainText: stateAfterB.doc.textContent,
    });

    const finalVersion = midVersion + stepsB.length;
    const replayed = history.replayDocumentToVersion(documentId, finalVersion);

    expect(replayed.currentVersion).toBe(finalVersion);
    // Full tree equality: replay rebuilt the doc from v0 checkpoint and
    // step log, so its JSON should match the post-step editor state.
    expect(replayed.contentJson).toEqual(stateAfterB.doc.toJSON());
    expect(replayed.plainText).toBe("Hello world");
  });

  it("uses the latest checkpoint at or before targetVersion as the replay base", () => {
    const state = workspace.ensureWorkspaceState();
    const documentId = state.activeDocument!.id;
    const startVersion = state.activeDocument!.currentVersion;

    // Step 1: insert "Hello" → v1
    const editorStart = EditorState.create({
      schema: basicSchema,
      doc: basicSchema.nodeFromJSON(state.activeDocument!.contentJson),
    });
    const txA = editorStart.tr.insertText("Hello", 1);
    const stateAfterA = editorStart.apply(txA);
    workspace.applyDocumentTransaction({
      documentId,
      baseVersion: startVersion,
      title: state.activeDocument!.title,
      steps: txA.steps.map((s) => s.toJSON() as JsonObject),
      inverseSteps: txA.steps.map((s, i) => s.invert(txA.docs[i]!).toJSON() as JsonObject),
      contentJson: stateAfterA.doc.toJSON() as JsonObject,
      plainText: stateAfterA.doc.textContent,
    });

    // Drop in a mid-sequence checkpoint at v1 with the post-Hello content.
    // This simulates an auto-checkpoint without forcing 200 transactions.
    const v1Workspace = workspace.loadWorkspace();
    const v1Snapshot = v1Workspace.activeDocument!;
    history.writeCheckpoint(v1Snapshot, "test-mid-sequence");

    // Step 2: insert " world" → v2
    const txB = stateAfterA.tr.insertText(" world", txA.selection.to);
    const stateAfterB = stateAfterA.apply(txB);
    workspace.applyDocumentTransaction({
      documentId,
      baseVersion: startVersion + 1,
      title: state.activeDocument!.title,
      steps: txB.steps.map((s) => s.toJSON() as JsonObject),
      inverseSteps: txB.steps.map((s, i) => s.invert(txB.docs[i]!).toJSON() as JsonObject),
      contentJson: stateAfterB.doc.toJSON() as JsonObject,
      plainText: stateAfterB.doc.textContent,
    });

    // Replay at v2 should pick the v1 checkpoint (not the v0 one) and apply
    // exactly the one " world" step from the log.
    const replayed = history.replayDocumentToVersion(documentId, startVersion + 2);
    expect(replayed.contentJson).toEqual(stateAfterB.doc.toJSON());

    // Sanity: replay at v1 should land on the checkpoint with no steps applied.
    const replayedV1 = history.replayDocumentToVersion(documentId, startVersion + 1);
    expect(replayedV1.contentJson).toEqual(stateAfterA.doc.toJSON());
  });

  it("throws when no checkpoint exists at or before targetVersion", () => {
    const state = workspace.ensureWorkspaceState();
    const documentId = state.activeDocument!.id;

    // Wipe the v0 checkpoint to simulate a missing-checkpoint scenario.
    harness.getConnection()
      .prepare("DELETE FROM document_checkpoints WHERE document_id = ?")
      .run(documentId);

    expect(() => history.replayDocumentToVersion(documentId, 0))
      .toThrow(/No checkpoint/);
  });

  it("loadHistorySummary returns matching step + checkpoint counts after multi-tx replay", () => {
    const state = workspace.ensureWorkspaceState();
    const documentId = state.activeDocument!.id;

    const editorStart = EditorState.create({
      schema: basicSchema,
      doc: basicSchema.nodeFromJSON(state.activeDocument!.contentJson),
    });
    const tx = editorStart.tr.insertText("abc", 1);
    const after = editorStart.apply(tx);
    workspace.applyDocumentTransaction({
      documentId,
      baseVersion: state.activeDocument!.currentVersion,
      title: state.activeDocument!.title,
      steps: tx.steps.map((s) => s.toJSON() as JsonObject),
      inverseSteps: tx.steps.map((s, i) => s.invert(tx.docs[i]!).toJSON() as JsonObject),
      contentJson: after.doc.toJSON() as JsonObject,
      plainText: after.doc.textContent,
      saveIntent: true,
    });

    const summary = history.loadHistorySummary(documentId, state.activeDocument!.currentVersion + 1);
    expect(summary.stepCount).toBeGreaterThanOrEqual(1);
    expect(summary.checkpointCount).toBeGreaterThanOrEqual(2);
    expect(summary.currentVersion).toBe(state.activeDocument!.currentVersion + 1);
  });
});

// Small helper kept here in case future tests need it — Step.fromJSON via the
// repository already exercises round-tripping, so we don't re-validate it.
function _docFromJson(json: JsonObject): ProseMirrorNode {
  return basicSchema.nodeFromJSON(json);
}
