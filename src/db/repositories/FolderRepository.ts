import type {
  CreateFolderInput,
  DeleteFolderInput,
  DocumentFolderRecord,
  MoveFolderInput,
  UpdateFolderInput,
} from "../../shared/domain/workspace";
import type { SqliteHarness } from "../sqliteHarness";
import { isoNow } from "../utils";
import type { RawFolderRow } from "../rowTypes";
import { mapFolderRow } from "../rowMappers";
import type { HistoryRepository } from "./HistoryRepository";

export type FolderInsertInput = {
  id: string;
  projectId: string;
  parentFolderId: string | null;
  title: string;
  ordering: number;
  createdAt: string;
  updatedAt: string;
};

export type DeleteFolderResult = {
  row: RawFolderRow | null;
};

const ORDERING_STEP = 1024;

export class FolderRepository {
  constructor(
    private readonly sqlite: SqliteHarness,
    private readonly history: HistoryRepository,
  ) {}

  // ──────────────── reads ────────────────

  loadFolders(projectId: string): DocumentFolderRecord[] {
    const rows = this.sqlite.getConnection().prepare(`
      SELECT id, project_id, parent_folder_id, title, ordering, created_at, updated_at
      FROM document_folders
      WHERE project_id = ?
      ORDER BY ordering ASC, title COLLATE NOCASE ASC
    `).all(projectId) as RawFolderRow[];

    return rows.map(mapFolderRow);
  }

  loadFolderIds(projectId: string): string[] {
    return this.loadFolders(projectId).map((folder) => folder.id);
  }

  // ──────────────── mutations ────────────────

  createFolder(input: CreateFolderInput, folderId: string): DocumentFolderRecord {
    const now = isoNow();
    const parentFolderId = input.parentFolderId ?? null;
    const ordering = this.nextFolderOrdering(input.projectId, parentFolderId);
    const title = input.title.trim() || "New Folder";

    this.insertFolder({
      id: folderId,
      projectId: input.projectId,
      parentFolderId,
      title,
      ordering,
      createdAt: now,
      updatedAt: now,
    });

    this.history.appendEvent("folder", folderId, "folderCreated", 0, { title });

    return {
      id: folderId,
      projectId: input.projectId,
      parentFolderId,
      title,
      ordering,
      createdAt: now,
      updatedAt: now,
    };
  }

  updateFolder(input: UpdateFolderInput): void {
    const now = isoNow();
    const title = input.title.trim() || "Untitled Folder";
    this.sqlite.getConnection().prepare(`
      UPDATE document_folders
      SET title = ?, updated_at = ?
      WHERE id = ?
    `).run(title, now, input.folderId);
    this.history.appendEvent("folder", input.folderId, "folderUpdated", 0, { title });
  }

  // Reparent + reorder in one mutation. Cycle prevention: a folder cannot
  // become a descendant of itself. Sibling ordering uses sparse INTs with
  // lazy recompaction when the gap shrinks to <= 1.
  moveFolder(input: MoveFolderInput): DocumentFolderRecord {
    const folder = this.requireFolderRow(input.folderId);
    const newParentFolderId = input.newParentFolderId;

    if (newParentFolderId === input.folderId) {
      throw new Error("Cannot move a folder into itself.");
    }
    if (newParentFolderId !== null) {
      const descendants = this.loadDescendantFolderIds(input.folderId);
      if (descendants.has(newParentFolderId)) {
        throw new Error("Cannot move a folder into one of its descendants.");
      }
      this.requireFolderRow(newParentFolderId);
    }

    const ordering = this.computeMoveOrdering(
      folder.project_id,
      newParentFolderId,
      input.folderId,
      input.beforeFolderId,
    );

    const now = isoNow();
    this.sqlite.getConnection().prepare(`
      UPDATE document_folders
      SET parent_folder_id = ?, ordering = ?, updated_at = ?
      WHERE id = ?
    `).run(newParentFolderId, ordering, now, input.folderId);

    this.history.appendEvent("folder", input.folderId, "folderMoved", 0, {
      fromParentFolderId: folder.parent_folder_id,
      toParentFolderId: newParentFolderId,
      ordering,
    });

    return mapFolderRow({
      ...folder,
      parent_folder_id: newParentFolderId,
      ordering,
      updated_at: now,
    });
  }

  deleteFolder(input: DeleteFolderInput): DeleteFolderResult {
    const database = this.sqlite.getConnection();
    const folder = database.prepare(`
      SELECT id, project_id, parent_folder_id, title, ordering, created_at, updated_at
      FROM document_folders
      WHERE id = ?
    `).get(input.folderId) as RawFolderRow | undefined;

    if (!folder) {
      return { row: null };
    }

    // Folders are organization, not ownership: deleting a folder reparents
    // its children (sub-folders + documents) to the deleted folder's
    // parent. Children are appended to the new parent's sibling lists.
    const now = isoNow();
    const promotedFolders = database.prepare(`
      SELECT id, ordering
      FROM document_folders
      WHERE parent_folder_id = ?
      ORDER BY ordering ASC
    `).all(input.folderId) as Array<{ id: string; ordering: number }>;
    if (promotedFolders.length > 0) {
      let nextOrdering = this.nextFolderOrdering(folder.project_id, folder.parent_folder_id);
      const updateFolderStmt = database.prepare(`
        UPDATE document_folders
        SET parent_folder_id = ?, ordering = ?, updated_at = ?
        WHERE id = ?
      `);
      for (const child of promotedFolders) {
        updateFolderStmt.run(folder.parent_folder_id, nextOrdering, now, child.id);
        nextOrdering += ORDERING_STEP;
      }
    }

    const promotedDocs = database.prepare(`
      SELECT id, ordering
      FROM documents
      WHERE folder_id = ?
      ORDER BY ordering ASC
    `).all(input.folderId) as Array<{ id: string; ordering: number }>;
    if (promotedDocs.length > 0) {
      let nextOrdering = this.nextDocumentOrdering(folder.project_id, folder.parent_folder_id);
      const updateDocStmt = database.prepare(`
        UPDATE documents
        SET folder_id = ?, ordering = ?, updated_at = ?
        WHERE id = ?
      `);
      for (const child of promotedDocs) {
        updateDocStmt.run(folder.parent_folder_id, nextOrdering, now, child.id);
        nextOrdering += ORDERING_STEP;
      }
    }

    database.prepare("DELETE FROM document_folders WHERE id = ?").run(input.folderId);

    this.history.appendEvent("folder", input.folderId, "folderDeleted", 0, { title: folder.title });
    return { row: folder };
  }

  // ──────────────── private ────────────────

  insertFolder(input: FolderInsertInput): void {
    this.sqlite.getConnection().prepare(`
      INSERT INTO document_folders (
        id,
        project_id,
        parent_folder_id,
        title,
        ordering,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.id,
      input.projectId,
      input.parentFolderId,
      input.title,
      input.ordering,
      input.createdAt,
      input.updatedAt,
    );
  }

  loadDescendantFolderIds(folderId: string): Set<string> {
    const rows = this.sqlite.getConnection().prepare(`
      WITH RECURSIVE descendants(id) AS (
        SELECT id FROM document_folders WHERE parent_folder_id = ?
        UNION ALL
        SELECT df.id
        FROM document_folders df
        INNER JOIN descendants d ON df.parent_folder_id = d.id
      )
      SELECT id FROM descendants
    `).all(folderId) as Array<{ id: string }>;
    return new Set(rows.map((row) => row.id));
  }

  requireFolderRow(folderId: string): RawFolderRow {
    const row = this.sqlite.getConnection().prepare(`
      SELECT id, project_id, parent_folder_id, title, ordering, created_at, updated_at
      FROM document_folders
      WHERE id = ?
    `).get(folderId) as RawFolderRow | undefined;
    if (!row) {
      throw new Error(`Missing folder ${folderId}.`);
    }
    return row;
  }

  private nextFolderOrdering(projectId: string, parentFolderId: string | null): number {
    const row = this.sqlite.getConnection().prepare(`
      SELECT COALESCE(MAX(ordering), -1) AS ordering
      FROM document_folders
      WHERE project_id = ?
        AND parent_folder_id IS ?
    `).get(projectId, parentFolderId) as { ordering: number };
    return row.ordering < 0 ? 0 : row.ordering + ORDERING_STEP;
  }

  // Mirrors DocumentRepository.nextDocumentOrdering — kept here so that
  // folder deletion can reparent its child documents without reaching
  // across repository boundaries during the same transaction.
  private nextDocumentOrdering(projectId: string, folderId: string | null): number {
    const row = this.sqlite.getConnection().prepare(`
      SELECT COALESCE(MAX(ordering), -1) AS ordering
      FROM documents
      WHERE project_id = ?
        AND folder_id IS ?
    `).get(projectId, folderId) as { ordering: number };
    return row.ordering < 0 ? 0 : row.ordering + ORDERING_STEP;
  }

  // Sparse-with-lazy-recompaction. Common case: 1 row update + the folderMoved
  // event. Recompaction only fires when an insert gap shrinks to <= 1.
  private computeMoveOrdering(
    projectId: string,
    parentFolderId: string | null,
    movingFolderId: string,
    beforeFolderId: string | null,
  ): number {
    const siblings = this.loadSiblingsForOrdering(projectId, parentFolderId, movingFolderId);
    if (siblings.length === 0) return 0;

    if (beforeFolderId === null) {
      return siblings[siblings.length - 1].ordering + ORDERING_STEP;
    }

    const idx = siblings.findIndex((sibling) => sibling.id === beforeFolderId);
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

    this.recompactSiblings(projectId, parentFolderId);
    const recompacted = this.loadSiblingsForOrdering(projectId, parentFolderId, movingFolderId);
    const newIdx = recompacted.findIndex((sibling) => sibling.id === beforeFolderId);
    if (newIdx <= 0) return recompacted[0].ordering - ORDERING_STEP;
    const recompactedPrev = recompacted[newIdx - 1];
    const recompactedNext = recompacted[newIdx];
    return Math.floor((recompactedPrev.ordering + recompactedNext.ordering) / 2);
  }

  private loadSiblingsForOrdering(
    projectId: string,
    parentFolderId: string | null,
    excludeFolderId: string,
  ): Array<{ id: string; ordering: number }> {
    return this.sqlite.getConnection().prepare(`
      SELECT id, ordering
      FROM document_folders
      WHERE project_id = ?
        AND parent_folder_id IS ?
        AND id != ?
      ORDER BY ordering ASC
    `).all(projectId, parentFolderId, excludeFolderId) as Array<{ id: string; ordering: number }>;
  }

  private recompactSiblings(projectId: string, parentFolderId: string | null): void {
    const rows = this.sqlite.getConnection().prepare(`
      SELECT id
      FROM document_folders
      WHERE project_id = ?
        AND parent_folder_id IS ?
      ORDER BY ordering ASC, title COLLATE NOCASE ASC
    `).all(projectId, parentFolderId) as Array<{ id: string }>;
    const stmt = this.sqlite.getConnection().prepare(`
      UPDATE document_folders SET ordering = ? WHERE id = ?
    `);
    rows.forEach((row, index) => {
      stmt.run(index * ORDERING_STEP, row.id);
    });
  }

  folderExists(projectId: string): boolean {
    const row = this.sqlite.getConnection().prepare(`
      SELECT id
      FROM document_folders
      WHERE project_id = ?
      LIMIT 1
    `).get(projectId) as { id: string } | undefined;
    return Boolean(row);
  }
}
