import {
  HARNESS_CONTENT_FORMAT,
  HARNESS_CONTENT_SCHEMA_VERSION,
  type JsonObject,
  type StoredDocumentSnapshot,
} from "../../shared/domain/document";
import type {
  ApplyDocumentTransactionInput,
  CreateDocumentInput,
  DeleteDocumentInput,
  DocumentSummary,
  MoveDocumentInput,
  ReorderDocumentInput,
  UpdateDocumentMetaInput,
} from "../../shared/domain/workspace";
import { DEFAULT_PROJECT_ID } from "../../shared/domain/workspace";
import type { SqliteHarness } from "../sqliteHarness";
import { isoNow } from "../utils";
import type { RawDocumentRow } from "../rowTypes";
import { buildEmptyDocumentJson, mapDocumentSnapshot, mapDocumentSummary } from "../rowMappers";
import type { HistoryRepository } from "./HistoryRepository";

export type DocumentInsertInput = {
  id: string;
  projectId: string;
  folderId: string | null;
  ordering: number;
  title: string;
  contentJson: JsonObject;
  plainText: string;
};

export type ApplyDocumentTransactionCore = {
  snapshot: StoredDocumentSnapshot;
  summary: DocumentSummary;
  row: RawDocumentRow;
  nextVersion: number;
};

export type DeletedDocument = {
  projectId: string;
  title: string;
  currentVersion: number;
  sliceIds: string[];
};

const ORDERING_STEP = 1024;

export class DocumentRepository {
  constructor(
    private readonly sqlite: SqliteHarness,
    private readonly history: HistoryRepository,
  ) {}

  // ──────────────── reads ────────────────

  loadDocumentSummaries(projectId: string): DocumentSummary[] {
    const rows = this.sqlite.getConnection().prepare(`
      SELECT
        id,
        project_id,
        folder_id,
        ordering,
        title,
        content_format,
        content_schema_version,
        content_json,
        plain_text,
        current_version,
        created_at,
        updated_at
      FROM documents
      WHERE project_id = ?
      ORDER BY folder_id ASC, ordering ASC, updated_at DESC
    `).all(projectId) as RawDocumentRow[];

    return rows.map(mapDocumentSummary);
  }

  loadDocumentSnapshot(documentId: string): StoredDocumentSnapshot | null {
    const row = this.loadDocumentRow(documentId);
    return row ? mapDocumentSnapshot(row) : null;
  }

  requireDocumentSnapshot(documentId: string): StoredDocumentSnapshot {
    const snapshot = this.loadDocumentSnapshot(documentId);
    if (!snapshot) {
      throw new Error(`Missing document ${documentId}.`);
    }
    return snapshot;
  }

  requireDocumentSummary(documentId: string): DocumentSummary {
    return mapDocumentSummary(this.requireDocumentRow(documentId));
  }

  loadDocumentRow(documentId: string): RawDocumentRow | null {
    const row = this.sqlite.getConnection().prepare(`
      SELECT
        id,
        project_id,
        folder_id,
        ordering,
        title,
        content_format,
        content_schema_version,
        content_json,
        plain_text,
        current_version,
        created_at,
        updated_at
      FROM documents
      WHERE id = ?
    `).get(documentId) as RawDocumentRow | undefined;
    return row ?? null;
  }

  requireDocumentRow(documentId: string): RawDocumentRow {
    const row = this.loadDocumentRow(documentId);
    if (!row) {
      throw new Error(`Missing document ${documentId}.`);
    }
    return row;
  }

  loadDocumentRowsForFolder(projectId: string, folderId: string | null): RawDocumentRow[] {
    return this.sqlite.getConnection().prepare(`
      SELECT
        id,
        project_id,
        folder_id,
        ordering,
        title,
        content_format,
        content_schema_version,
        content_json,
        plain_text,
        current_version,
        created_at,
        updated_at
      FROM documents
      WHERE project_id = ?
        AND folder_id IS ?
      ORDER BY ordering ASC
    `).all(projectId, folderId) as RawDocumentRow[];
  }

  nextDocumentOrdering(projectId: string, folderId: string | null): number {
    const row = this.sqlite.getConnection().prepare(`
      SELECT COALESCE(MAX(ordering), -1) AS ordering
      FROM documents
      WHERE project_id = ?
        AND folder_id IS ?
    `).get(projectId, folderId) as { ordering: number };
    return row.ordering < 0 ? 0 : row.ordering + ORDERING_STEP;
  }

  // ──────────────── mutations ────────────────

  createDocument(input: CreateDocumentInput, documentId: string): StoredDocumentSnapshot {
    const ordering = this.nextDocumentOrdering(input.projectId, input.folderId);
    const title = input.title.trim() || "Untitled Document";
    this.insertDocument({
      id: documentId,
      projectId: input.projectId,
      folderId: input.folderId,
      ordering,
      title,
      contentJson: buildEmptyDocumentJson(),
      plainText: "",
    });

    const snapshot = this.requireDocumentSnapshot(documentId);
    this.history.ensureCheckpoint(snapshot, "document-created");
    this.history.appendEvent("document", documentId, "documentCreated", 0, {
      title,
      folderId: input.folderId,
    });
    return snapshot;
  }

  updateDocumentMeta(input: UpdateDocumentMetaInput): DocumentSummary {
    const row = this.requireDocumentRow(input.documentId);
    const snapshot = mapDocumentSnapshot(row);
    const now = isoNow();
    let folderId = row.folder_id;
    let ordering = row.ordering;

    if (input.folderId !== undefined && input.folderId !== row.folder_id) {
      folderId = input.folderId;
      ordering = this.nextDocumentOrdering(row.project_id ?? DEFAULT_PROJECT_ID, folderId);
    }

    const title = input.title ?? snapshot.title;
    this.sqlite.getConnection().prepare(`
      UPDATE documents
      SET title = ?, folder_id = ?, ordering = ?, updated_at = ?
      WHERE id = ?
    `).run(title, folderId, ordering, now, input.documentId);

    this.history.appendEvent("document", input.documentId, "documentMetaUpdated", row.current_version, {
      title,
      folderId,
    });
    return this.requireDocumentSummary(input.documentId);
  }

  // Returns the metadata the caller needs for cascade + layout fixups;
  // actual slice deletion is driven by the caller so the cross-aggregate
  // transaction remains a single runInTransaction in the facade.
  deleteDocument(input: DeleteDocumentInput): DeletedDocument {
    const database = this.sqlite.getConnection();
    const row = this.requireDocumentRow(input.documentId);
    const sliceRows = database.prepare(`
      SELECT id
      FROM slices
      WHERE document_id = ?
    `).all(input.documentId) as Array<{ id: string }>;

    this.history.deleteDocumentHistory(input.documentId);
    database.prepare("DELETE FROM documents WHERE id = ?").run(input.documentId);
    this.history.appendEvent("document", input.documentId, "documentDeleted", row.current_version, {
      title: row.title,
    });

    return {
      projectId: row.project_id ?? DEFAULT_PROJECT_ID,
      title: row.title,
      currentVersion: row.current_version,
      sliceIds: sliceRows.map((slice) => slice.id),
    };
  }

  // Reparent + reorder in one mutation. Sibling ordering uses sparse INTs
  // with lazy recompaction when the gap shrinks to <= 1. Distinct from
  // reorderDocument (up/down keyboard swap) which stays unchanged for
  // keyboard accessibility.
  moveDocument(input: MoveDocumentInput): DocumentSummary {
    const row = this.requireDocumentRow(input.documentId);
    const projectId = row.project_id ?? DEFAULT_PROJECT_ID;
    const newFolderId = input.newFolderId;

    const ordering = this.computeMoveOrdering(
      projectId,
      newFolderId,
      input.documentId,
      input.beforeDocumentId,
    );

    const now = isoNow();
    this.sqlite.getConnection().prepare(`
      UPDATE documents
      SET folder_id = ?, ordering = ?, updated_at = ?
      WHERE id = ?
    `).run(newFolderId, ordering, now, input.documentId);

    this.history.appendEvent("document", input.documentId, "documentMoved", row.current_version, {
      fromFolderId: row.folder_id,
      toFolderId: newFolderId,
      ordering,
    });

    return this.requireDocumentSummary(input.documentId);
  }

  reorderDocument(input: ReorderDocumentInput): RawDocumentRow | null {
    const current = this.requireDocumentRow(input.documentId);
    const siblings = this.loadDocumentRowsForFolder(
      current.project_id ?? DEFAULT_PROJECT_ID,
      current.folder_id,
    );
    const index = siblings.findIndex((candidate) => candidate.id === input.documentId);
    if (index === -1) {
      return current;
    }

    const swapIndex = input.direction === "up" ? index - 1 : index + 1;
    const swapWith = siblings[swapIndex];
    if (!swapWith) {
      return current;
    }

    const database = this.sqlite.getConnection();
    const fromOrdering = current.ordering;
    const toOrdering = swapWith.ordering;
    database.prepare("UPDATE documents SET ordering = ? WHERE id = ?").run(toOrdering, current.id);
    database.prepare("UPDATE documents SET ordering = ? WHERE id = ?").run(fromOrdering, swapWith.id);

    // Both sides of the swap are captured so a replay can reconstruct the
    // pair without re-deriving sibling order from the projection.
    this.history.appendEvent("document", current.id, "documentReordered", current.current_version, {
      documentId: current.id,
      fromOrdering,
      toOrdering,
      swapDocumentId: swapWith.id,
      swapFromOrdering: toOrdering,
      swapToOrdering: fromOrdering,
    });
    return current;
  }

  // Persists the new content + appends step rows + optionally checkpoints.
  // The caller (WorkspaceRepository) arranges the outer transaction and
  // triggers slice boundary re-anchoring.
  applyDocumentTransaction(input: ApplyDocumentTransactionInput): ApplyDocumentTransactionCore {
    const snapshot = this.requireDocumentSnapshot(input.documentId);
    if (snapshot.currentVersion !== input.baseVersion) {
      throw new Error(`Version mismatch. Expected ${snapshot.currentVersion}, received ${input.baseVersion}.`);
    }

    const nextVersion = input.baseVersion + input.steps.length;
    this.history.appendDocumentSteps({
      documentId: input.documentId,
      baseVersion: input.baseVersion,
      steps: input.steps,
      inverseSteps: input.inverseSteps,
    });

    const now = isoNow();
    this.sqlite.getConnection().prepare(`
      UPDATE documents
      SET
        title = ?,
        content_json = ?,
        plain_text = ?,
        current_version = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      input.title,
      JSON.stringify(input.contentJson),
      input.plainText,
      nextVersion,
      now,
      input.documentId,
    );

    const updatedSnapshot = this.requireDocumentSnapshot(input.documentId);
    if (input.saveIntent || this.history.shouldAutoCheckpoint(nextVersion)) {
      this.history.ensureCheckpoint(
        updatedSnapshot,
        input.saveIntent ? "explicit-save" : `auto-${nextVersion}`,
      );
    }

    return {
      snapshot: updatedSnapshot,
      summary: this.requireDocumentSummary(input.documentId),
      row: this.requireDocumentRow(input.documentId),
      nextVersion,
    };
  }

  // ──────────────── private ────────────────

  // Sparse-with-lazy-recompaction (mirror of FolderRepository's helper).
  // Common case: 1 row update + the documentMoved event. Recompaction
  // only fires when an insert gap shrinks to <= 1.
  private computeMoveOrdering(
    projectId: string,
    folderId: string | null,
    movingDocumentId: string,
    beforeDocumentId: string | null,
  ): number {
    const siblings = this.loadSiblingsForOrdering(projectId, folderId, movingDocumentId);
    if (siblings.length === 0) return 0;

    if (beforeDocumentId === null) {
      return siblings[siblings.length - 1].ordering + ORDERING_STEP;
    }

    const idx = siblings.findIndex((sibling) => sibling.id === beforeDocumentId);
    if (idx === -1) {
      return siblings[siblings.length - 1].ordering + ORDERING_STEP;
    }

    if (idx === 0) {
      return siblings[0].ordering - ORDERING_STEP;
    }

    const prev = siblings[idx - 1];
    const next = siblings[idx];
    if (next.ordering - prev.ordering > 1) {
      return Math.floor((prev.ordering + next.ordering) / 2);
    }

    this.recompactSiblings(projectId, folderId);
    const recompacted = this.loadSiblingsForOrdering(projectId, folderId, movingDocumentId);
    const newIdx = recompacted.findIndex((sibling) => sibling.id === beforeDocumentId);
    if (newIdx <= 0) return recompacted[0].ordering - ORDERING_STEP;
    const recompactedPrev = recompacted[newIdx - 1];
    const recompactedNext = recompacted[newIdx];
    return Math.floor((recompactedPrev.ordering + recompactedNext.ordering) / 2);
  }

  private loadSiblingsForOrdering(
    projectId: string,
    folderId: string | null,
    excludeDocumentId: string,
  ): Array<{ id: string; ordering: number }> {
    return this.sqlite.getConnection().prepare(`
      SELECT id, ordering
      FROM documents
      WHERE project_id = ?
        AND folder_id IS ?
        AND id != ?
      ORDER BY ordering ASC
    `).all(projectId, folderId, excludeDocumentId) as Array<{ id: string; ordering: number }>;
  }

  private recompactSiblings(projectId: string, folderId: string | null): void {
    const rows = this.sqlite.getConnection().prepare(`
      SELECT id
      FROM documents
      WHERE project_id = ?
        AND folder_id IS ?
      ORDER BY ordering ASC, updated_at DESC
    `).all(projectId, folderId) as Array<{ id: string }>;
    const stmt = this.sqlite.getConnection().prepare(`
      UPDATE documents SET ordering = ? WHERE id = ?
    `);
    rows.forEach((row, index) => {
      stmt.run(index * ORDERING_STEP, row.id);
    });
  }

  insertDocument(input: DocumentInsertInput): void {
    const now = isoNow();
    this.sqlite.getConnection().prepare(`
      INSERT INTO documents (
        id,
        project_id,
        folder_id,
        ordering,
        title,
        content_format,
        content_schema_version,
        content_json,
        plain_text,
        current_version,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.id,
      input.projectId,
      input.folderId,
      input.ordering,
      input.title,
      HARNESS_CONTENT_FORMAT,
      HARNESS_CONTENT_SCHEMA_VERSION,
      JSON.stringify(input.contentJson),
      input.plainText,
      0,
      now,
      now,
    );
  }
}
