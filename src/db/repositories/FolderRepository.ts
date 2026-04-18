import type {
  CreateFolderInput,
  DeleteFolderInput,
  DocumentFolderRecord,
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
    const ordering = this.nextFolderOrdering(input.projectId);
    const title = input.title.trim() || "New Folder";

    this.insertFolder({
      id: folderId,
      projectId: input.projectId,
      parentFolderId: input.parentFolderId ?? null,
      title,
      ordering,
      createdAt: now,
      updatedAt: now,
    });

    this.history.appendEvent("folder", folderId, "folderCreated", 0, { title });

    return {
      id: folderId,
      projectId: input.projectId,
      parentFolderId: input.parentFolderId ?? null,
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

    // Documents inside the deleted folder fall to "project root" rather
    // than being deleted — matches how the UI presents the delete.
    database.prepare(`
      UPDATE documents
      SET folder_id = NULL, updated_at = ?
      WHERE folder_id = ?
    `).run(isoNow(), input.folderId);
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

  private nextFolderOrdering(projectId: string): number {
    const row = this.sqlite.getConnection().prepare(`
      SELECT COALESCE(MAX(ordering), -1) AS ordering
      FROM document_folders
      WHERE project_id = ?
    `).get(projectId) as { ordering: number };
    return row.ordering + 1;
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
