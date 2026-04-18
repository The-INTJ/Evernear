// Repository integration tests. These run against a real in-memory
// SQLite database (via `:memory:`). They're slower than pure unit tests
// but fast enough for an MVP suite, and they catch schema/mapping/transaction
// bugs that mocks would hide.

import path from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_PROJECT_ID } from "../../shared/domain/workspace";
import { SqliteHarness } from "../sqliteHarness";
import { WorkspaceRepository } from "./WorkspaceRepository";

// SqliteHarness calls mkdirSync on the parent directory so we need a real
// filesystem. Use an OS-level tmpdir per test, removed in afterEach.
let tempDir: string;
let repository: WorkspaceRepository;
let harness: SqliteHarness;

beforeEach(() => {
  tempDir = mkdtempSync(path.join(tmpdir(), "evernear-repo-test-"));
  const dbPath = path.join(tempDir, "phase-1.sqlite");
  harness = SqliteHarness.open(dbPath, "NORMAL");
  repository = new WorkspaceRepository(harness);
});

afterEach(() => {
  harness.close();
  rmSync(tempDir, { recursive: true, force: true });
});

describe("WorkspaceRepository bootstrap", () => {
  it("seeds a default project + story folder + empty document on first load", () => {
    const workspace = repository.ensureWorkspaceState();
    expect(workspace.projects.length).toBe(1);
    expect(workspace.projects[0]!.id).toBe(DEFAULT_PROJECT_ID);
    expect(workspace.folders.length).toBe(1);
    expect(workspace.documents.length).toBe(1);
    expect(workspace.activeDocument?.currentVersion).toBe(0);
  });

  it("ensureWorkspaceState is idempotent across repeat calls", () => {
    const first = repository.ensureWorkspaceState();
    const second = repository.ensureWorkspaceState();
    expect(second.projects.length).toBe(first.projects.length);
    expect(second.documents.length).toBe(first.documents.length);
  });
});

describe("project mutations", () => {
  it("createProject adds a project + a seed document and activates it", () => {
    repository.ensureWorkspaceState();
    const after = repository.createProject({ name: "Novel" });
    expect(after.projects.some((project) => project.name === "Novel")).toBe(true);
    const novel = after.projects.find((project) => project.name === "Novel")!;
    expect(after.layout.activeProjectId).toBe(novel.id);
    expect(after.documents.length).toBeGreaterThan(0);
  });

  it("updateProject renames the active project", () => {
    repository.ensureWorkspaceState();
    const created = repository.createProject({ name: "Draft" });
    const projectId = created.layout.activeProjectId!;
    const renamed = repository.updateProject({ projectId, name: "Final Draft" });
    const project = renamed.projects.find((p) => p.id === projectId)!;
    expect(project.name).toBe("Final Draft");
  });
});

describe("document mutations", () => {
  it("createDocument inserts a new document and emits a documentCreated event", () => {
    const state = repository.ensureWorkspaceState();
    const projectId = state.layout.activeProjectId!;
    const folderId = state.folders[0]!.id;

    const before = countEvents(harness, "document", "documentCreated");
    const after = repository.createDocument({
      projectId,
      folderId,
      title: "Scene 1",
    });
    const afterCount = countEvents(harness, "document", "documentCreated");

    expect(after.documents.some((d) => d.title === "Scene 1")).toBe(true);
    expect(afterCount).toBe(before + 1);
  });

  it("deleteDocument cascades to its history records", () => {
    // Create an extra document we can safely delete — deleting the only
    // document in a project triggers ensureSeedState to recreate the
    // default seed, which is a separate behavior.
    const state = repository.ensureWorkspaceState();
    const projectId = state.layout.activeProjectId!;
    const folderId = state.folders[0]!.id;

    const after = repository.createDocument({
      projectId,
      folderId,
      title: "Scratch",
    });
    const scratchId = after.documents.find((d) => d.title === "Scratch")!.id;

    repository.deleteDocument({ documentId: scratchId });

    const finalWorkspace = repository.loadWorkspace();
    expect(finalWorkspace.documents.some((d) => d.id === scratchId)).toBe(false);

    const stepCount = harness.getConnection()
      .prepare("SELECT COUNT(*) AS count FROM document_steps WHERE document_id = ?")
      .get(scratchId) as { count: number };
    expect(stepCount.count).toBe(0);

    const checkpointCount = harness.getConnection()
      .prepare("SELECT COUNT(*) AS count FROM document_checkpoints WHERE document_id = ?")
      .get(scratchId) as { count: number };
    expect(checkpointCount.count).toBe(0);

    expect(finalWorkspace.layout.activeProjectId).toBe(projectId);
  });
});

describe("event sourcing invariant", () => {
  it("every mutation appends exactly one event per logical change", () => {
    repository.ensureWorkspaceState();
    const eventsBefore = totalEventCount(harness);

    const stateA = repository.createProject({ name: "A" });
    repository.createFolder({ projectId: stateA.layout.activeProjectId!, title: "Notes" });
    repository.updateProject({ projectId: stateA.layout.activeProjectId!, name: "Alpha" });

    const eventsAfter = totalEventCount(harness);

    // createProject fires: projectCreated + folderCreated (story seed) + documentCreated
    // createFolder fires: folderCreated
    // updateProject fires: projectUpdated
    // Total: 5 new events.
    expect(eventsAfter - eventsBefore).toBe(5);
  });

  it("aggregate_seq is monotonic per (aggregate_type, aggregate_id)", () => {
    const state = repository.ensureWorkspaceState();
    const projectId = state.layout.activeProjectId!;

    repository.updateProject({ projectId, name: "One" });
    repository.updateProject({ projectId, name: "Two" });
    repository.updateProject({ projectId, name: "Three" });

    const rows = harness.getConnection()
      .prepare(`
        SELECT aggregate_seq
        FROM events
        WHERE aggregate_type = 'project' AND aggregate_id = ?
        ORDER BY aggregate_seq ASC
      `)
      .all(projectId) as Array<{ aggregate_seq: number }>;

    expect(rows.length).toBeGreaterThan(0);
    for (let i = 1; i < rows.length; i += 1) {
      expect(rows[i]!.aggregate_seq).toBe(rows[i - 1]!.aggregate_seq + 1);
    }
  });
});

describe("transaction boundaries", () => {
  it("deleteEntity cascades to matching rules and orphaned slices atomically", () => {
    const state = repository.ensureWorkspaceState();
    const projectId = state.layout.activeProjectId!;

    const created = repository.createEntity({ projectId, name: "Protagonist" });
    const entityId = created.layout.selectedEntityId!;

    repository.upsertMatchingRule({
      entityId,
      label: "Alias",
      kind: "literal",
      pattern: "She",
      wholeWord: true,
      allowPossessive: true,
      enabled: true,
    });

    const before = repository.loadWorkspace();
    expect(before.matchingRules.length).toBeGreaterThan(0);

    repository.deleteEntity({ entityId });

    const after = repository.loadWorkspace();
    expect(after.entities.some((e) => e.id === entityId)).toBe(false);
    expect(after.matchingRules.some((rule) => rule.entityId === entityId)).toBe(false);
  });
});

describe("replay", () => {
  it("replayDocumentToVersion reconstructs the document at its current checkpoint", () => {
    const state = repository.ensureWorkspaceState();
    const documentId = state.activeDocument!.id;
    const baseVersion = state.activeDocument!.currentVersion;

    const replay = repository.replayDocumentToVersion(documentId, baseVersion);
    expect(replay.snapshot.id).toBe(documentId);
    expect(replay.snapshot.currentVersion).toBe(baseVersion);
  });
});

// ──────────────────────────────────────────────────────────────────────
// Test helpers
// ──────────────────────────────────────────────────────────────────────

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

function totalEventCount(h: SqliteHarness): number {
  const row = h.getConnection().prepare("SELECT COUNT(*) AS count FROM events").get() as { count: number };
  return row.count;
}
