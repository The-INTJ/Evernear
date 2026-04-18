import { randomUUID } from "node:crypto";

import type BetterSqlite3 from "better-sqlite3";
import { Node as ProseMirrorNode } from "prosemirror-model";
import { schema as basicSchema } from "prosemirror-schema-basic";
import { Mapping, Step } from "prosemirror-transform";

import {
  HARNESS_CONTENT_FORMAT,
  HARNESS_CONTENT_SCHEMA_VERSION,
  type JsonObject,
  type StoredDocumentSnapshot,
  collectDocumentMetrics,
} from "../shared/domain/document";
import {
  DEFAULT_FOLDER_ID,
  DEFAULT_PROJECT_ID,
  DEFAULT_PROJECT_NAME,
  DEFAULT_STORY_DOCUMENT_ID,
  DEFAULT_STORY_DOCUMENT_TITLE,
  type AnchorResolutionResult,
  type ApplyDocumentTransactionInput,
  type ApplyDocumentTransactionResult,
  type CreateDocumentInput,
  type CreateEntityInput,
  type CreateFolderInput,
  type CreateProjectInput,
  type CreateSliceInput,
  type DeleteDocumentInput,
  type DeleteEntityInput,
  type DeleteFolderInput,
  type DeleteMatchingRuleInput,
  type DeleteSliceInput,
  type DocumentFolderRecord,
  type DocumentSummary,
  type EntityRecord,
  type EntitySliceRecord,
  type HistorySummary,
  type MatchingRuleRecord,
  type OpenDocumentInput,
  type OpenProjectInput,
  type ProjectRecord,
  type ReorderDocumentInput,
  type SliceBoundaryRecord,
  type SliceRecord,
  type TextAnchor,
  type UpdateDocumentMetaInput,
  type UpdateEntityInput,
  type UpdateFolderInput,
  type UpdateLayoutInput,
  type UpdateProjectInput,
  type UpsertMatchingRuleInput,
  type WorkspaceDocumentReplayResult,
  type WorkspaceLayoutState,
  type WorkspaceState,
} from "../shared/domain/workspace";
import { SqliteHarness } from "./sqliteHarness";

/*
 * EXTRACTION ROADMAP — see refineCode.md §C2 and src/db/repositories/README.md.
 *
 * This file is a single ~2,000-line class that owns every aggregate's
 * persistence. The destination layout is already declared in
 * src/db/repositories/README.md. Until the split lands, every new mutation
 * makes the file harder to navigate. New mutations should go into the target
 * repository file below (create it if needed), not append here.
 *
 * Target layout:
 *
 *   src/db/repositories/
 *     ProjectRepository.ts   createProject, updateProject, openProject,
 *                             loadProjects, setActiveProjectId,
 *                             loadActiveProjectId, requireActiveProjectId
 *     FolderRepository.ts    createFolder, updateFolder, deleteFolder,
 *                             insertFolder, nextFolderOrdering, loadFolders,
 *                             loadDocumentRowsForFolder
 *     DocumentRepository.ts  createDocument, updateDocumentMeta,
 *                             deleteDocument, reorderDocument, openDocument,
 *                             insertDocument, nextDocumentOrdering,
 *                             loadDocumentSummaries, loadDocumentSnapshot,
 *                             requireDocumentSnapshot, requireDocumentSummary,
 *                             requireDocumentRow
 *     EntityRepository.ts    createEntity, updateEntity, deleteEntity,
 *                             upsertMatchingRule, deleteMatchingRule,
 *                             loadEntities, loadMatchingRulesForProject
 *     SliceRepository.ts     createSlice, deleteSlice, deleteSliceInternal,
 *                             loadSlices, loadEntitySlices,
 *                             loadSliceBoundariesForProject,
 *                             loadSliceBoundariesForDocument,
 *                             nextEntitySliceOrdering,
 *                             updateSliceBoundariesForDocument
 *     HistoryRepository.ts   applyDocumentTransaction (step path),
 *                             writeCheckpoint, replayDocumentToVersion,
 *                             loadHistorySummary, ensureCheckpoint,
 *                             appendEvent, replaySnapshotToVersion,
 *                             createMappingFromSteps
 *     LayoutRepository.ts    updateLayout, loadLayoutState, saveLayoutState
 *     WorkspaceRepository.ts loadWorkspace, ensureWorkspaceState,
 *                             ensureSeedState;
 *                             composes the others for cross-aggregate reads
 *
 *   src/db/anchoring.ts      pure functions over ProseMirror docs:
 *                             mapBoundaryForward, resolveAnchorWithFallback,
 *                             buildPlainTextIndex, walkNodeText,
 *                             offsetToPosition, buildAnchorFromRange,
 *                             resolveBlockPath, serializeNodePlainText
 *
 *   src/db/rowMappers.ts     mapDocumentSummary, mapDocumentRow,
 *                             mapSliceBoundaryRecord, buildEmptyDocumentJson
 *                             (or colocate each with the owning repository)
 *
 *   src/db/utils.ts          stableStringify, boolToInt, intToBool, isoNow,
 *                             truncate, uniqueStrings, safeParseStringArray
 *
 * Invariants that must survive the split:
 *
 *   1. Every public method runs inside sqliteHarness.runInTransaction(...).
 *      Each repository class takes SqliteHarness in its constructor.
 *   2. Every mutation appends a domain event before the method returns.
 *      appendEvent is called only inside a transaction.
 *   3. RawXxxRow types never leave the DB module — they're internal decoders.
 *   4. Repositories access the database through sqliteHarness.getConnection();
 *      they don't receive a raw Database handle from outside.
 *   5. Cross-aggregate reads (loadWorkspace) live on WorkspaceRepository and
 *      call the other repositories' read-only methods. Cross-aggregate writes
 *      stay in a single outer runInTransaction to preserve atomicity.
 *
 * How to split safely (one aggregate at a time):
 *
 *   1. Create the new repository file with the public method signatures.
 *   2. Move the public methods and their private helpers verbatim; keep
 *      event-append lines in place.
 *   3. Replace the moved methods here with thin delegating calls so
 *      main/index.ts keeps compiling during the transition.
 *   4. Once all aggregates are moved, delete this file; update main/index.ts
 *      to instantiate each repository individually (or a composed
 *      WorkspaceRepository that holds them).
 *
 * Do not add new mutations to this file. Add them to the target repository.
 */

const CHECKPOINT_INTERVAL = 200;

type RawProjectRow = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

type RawFolderRow = {
  id: string;
  project_id: string;
  parent_folder_id: string | null;
  title: string;
  ordering: number;
  created_at: string;
  updated_at: string;
};

type RawDocumentRow = {
  id: string;
  project_id: string | null;
  folder_id: string | null;
  ordering: number;
  title: string;
  content_format: string;
  content_schema_version: number;
  content_json: string;
  plain_text: string;
  current_version: number;
  created_at: string | null;
  updated_at: string;
};

type RawEntityRow = {
  id: string;
  project_id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

type RawMatchingRuleRow = {
  id: string;
  entity_id: string | null;
  label: string;
  kind: string;
  pattern: string;
  whole_word: number;
  allow_possessive: number;
  enabled: number;
  created_at: string | null;
  updated_at: string;
};

type RawSliceRow = {
  id: string;
  project_id: string;
  document_id: string;
  boundary_id: string;
  title: string;
  excerpt: string;
  created_at: string;
  updated_at: string;
};

type RawSliceBoundaryRow = {
  id: string;
  slice_id: string;
  document_id: string;
  anchor_json: string;
  resolution_status: string;
  resolution_reason: string;
  created_at: string;
  updated_at: string;
};

type RawEntitySliceRow = {
  entity_id: string;
  slice_id: string;
  ordering: number;
};

type RawLayoutRow = {
  project_id: string;
  active_document_id: string | null;
  panel_document_id: string | null;
  selected_entity_id: string | null;
  expanded_folder_ids_json: string;
  highlights_enabled: number;
  panel_open: number;
  panel_mode: string;
  last_focused_document_id: string | null;
  recent_target_document_ids_json: string;
  updated_at: string;
};

type RawStepRow = {
  id: string;
  document_id: string;
  version: number;
  step_json: string;
  inverse_step_json: string;
  created_at: string;
};

type RawCheckpointRow = {
  document_id: string;
  version: number;
  content_format: string;
  content_schema_version: number;
  content_json: string;
  plain_text: string;
  label: string | null;
  created_at: string;
};

type RawHistoryCountRow = {
  stepCount: number;
  checkpointCount: number;
};

type RawEventCountRow = {
  eventCount: number;
};

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

export class WorkspaceRepository {
  constructor(private readonly sqliteHarness: SqliteHarness) {}

  ensureWorkspaceState(): WorkspaceState {
    return this.sqliteHarness.runInTransaction(() => {
      this.ensureSeedState();
      return this.loadWorkspace();
    });
  }

  loadWorkspace(): WorkspaceState {
    const database = this.sqliteHarness.getConnection();
    this.ensureSeedState();

    const projects = this.loadProjects();
    const activeProjectId = this.requireActiveProjectId();
    const folders = this.loadFolders(activeProjectId);
    const documents = this.loadDocumentSummaries(activeProjectId);
    const entities = this.loadEntities(activeProjectId);
    const layout = this.loadLayoutState(activeProjectId, documents, entities);
    const activeDocument = layout.activeDocumentId ? this.loadDocumentSnapshot(layout.activeDocumentId) : null;
    const panelDocument = layout.panelDocumentId ? this.loadDocumentSnapshot(layout.panelDocumentId) : null;
    const slices = this.loadSlices(activeProjectId);
    const sliceBoundaries = this.loadSliceBoundariesForProject(activeProjectId);
    const entitySlices = this.loadEntitySlices(activeProjectId);
    const matchingRules = this.loadMatchingRulesForProject(activeProjectId);

    // SQLite can hold older invalid references if a row was removed before a later migration.
    if (layout.activeDocumentId && !activeDocument) {
      this.saveLayoutState(activeProjectId, {
        ...layout,
        activeDocumentId: documents[0]?.id ?? null,
      });
      return this.loadWorkspace();
    }

    if (layout.panelDocumentId && !panelDocument) {
      this.saveLayoutState(activeProjectId, {
        ...layout,
        panelDocumentId: null,
      });
      return this.loadWorkspace();
    }

    return {
      projects,
      folders,
      documents,
      activeDocument,
      panelDocument,
      entities,
      matchingRules,
      slices,
      sliceBoundaries,
      entitySlices,
      layout,
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  // BELOW → ProjectRepository.ts
  // createProject, updateProject, openProject
  // ══════════════════════════════════════════════════════════════════════
  createProject(input: CreateProjectInput): WorkspaceState {
    return this.sqliteHarness.runInTransaction(() => {
      const now = isoNow();
      const projectId = randomUUID();
      const folderId = randomUUID();
      const documentId = randomUUID();

      this.sqliteHarness.getConnection().prepare(`
        INSERT INTO projects (id, name, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `).run(projectId, input.name.trim() || DEFAULT_PROJECT_NAME, now, now);

      this.insertFolder({
        id: folderId,
        projectId,
        parentFolderId: null,
        title: "Story",
        ordering: 0,
        createdAt: now,
        updatedAt: now,
      });

      this.insertDocument({
        id: documentId,
        projectId,
        folderId,
        ordering: 0,
        title: DEFAULT_STORY_DOCUMENT_TITLE,
        contentJson: buildEmptyDocumentJson(),
        plainText: "",
      });

      this.setActiveProjectId(projectId);
      this.saveLayoutState(projectId, {
        activeProjectId: projectId,
        activeDocumentId: documentId,
        panelDocumentId: null,
        selectedEntityId: null,
        expandedFolderIds: [folderId],
        highlightsEnabled: true,
        panelOpen: true,
        panelMode: "entities",
        lastFocusedDocumentId: documentId,
        recentTargetDocumentIds: [documentId],
      });
      this.appendEvent("project", projectId, "projectCreated", 0, { name: input.name.trim() || DEFAULT_PROJECT_NAME });
      return this.loadWorkspace();
    });
  }

  updateProject(input: UpdateProjectInput): WorkspaceState {
    return this.sqliteHarness.runInTransaction(() => {
      const now = isoNow();
      this.sqliteHarness.getConnection().prepare(`
        UPDATE projects
        SET name = ?, updated_at = ?
        WHERE id = ?
      `).run(input.name.trim() || DEFAULT_PROJECT_NAME, now, input.projectId);
      this.appendEvent("project", input.projectId, "projectUpdated", 0, { name: input.name.trim() || DEFAULT_PROJECT_NAME });
      return this.loadWorkspace();
    });
  }

  openProject(input: OpenProjectInput): WorkspaceState {
    return this.sqliteHarness.runInTransaction(() => {
      this.setActiveProjectId(input.projectId);
      const documents = this.loadDocumentSummaries(input.projectId);
      const entities = this.loadEntities(input.projectId);
      this.loadLayoutState(input.projectId, documents, entities);
      return this.loadWorkspace();
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  // BELOW → FolderRepository.ts
  // createFolder, updateFolder, deleteFolder
  // ══════════════════════════════════════════════════════════════════════
  createFolder(input: CreateFolderInput): WorkspaceState {
    return this.sqliteHarness.runInTransaction(() => {
      const now = isoNow();
      const nextOrdering = this.nextFolderOrdering(input.projectId);
      const folderId = randomUUID();
      this.insertFolder({
        id: folderId,
        projectId: input.projectId,
        parentFolderId: input.parentFolderId ?? null,
        title: input.title.trim() || "New Folder",
        ordering: nextOrdering,
        createdAt: now,
        updatedAt: now,
      });

      const layout = this.loadLayoutState(input.projectId, this.loadDocumentSummaries(input.projectId), this.loadEntities(input.projectId));
      this.saveLayoutState(input.projectId, {
        ...layout,
        expandedFolderIds: uniqueStrings([...layout.expandedFolderIds, folderId]),
      });
      this.appendEvent("folder", folderId, "folderCreated", 0, { title: input.title.trim() || "New Folder" });
      return this.loadWorkspace();
    });
  }

  updateFolder(input: UpdateFolderInput): WorkspaceState {
    return this.sqliteHarness.runInTransaction(() => {
      const now = isoNow();
      this.sqliteHarness.getConnection().prepare(`
        UPDATE document_folders
        SET title = ?, updated_at = ?
        WHERE id = ?
      `).run(input.title.trim() || "Untitled Folder", now, input.folderId);
      this.appendEvent("folder", input.folderId, "folderUpdated", 0, { title: input.title.trim() || "Untitled Folder" });
      return this.loadWorkspace();
    });
  }

  deleteFolder(input: DeleteFolderInput): WorkspaceState {
    return this.sqliteHarness.runInTransaction(() => {
      const database = this.sqliteHarness.getConnection();
      const folder = database.prepare(`
        SELECT id, project_id, parent_folder_id, title, ordering, created_at, updated_at
        FROM document_folders
        WHERE id = ?
      `).get(input.folderId) as RawFolderRow | undefined;

      if (!folder) {
        return this.loadWorkspace();
      }

      database.prepare(`
        UPDATE documents
        SET folder_id = NULL, updated_at = ?
        WHERE folder_id = ?
      `).run(isoNow(), input.folderId);
      database.prepare("DELETE FROM document_folders WHERE id = ?").run(input.folderId);

      const documents = this.loadDocumentSummaries(folder.project_id);
      const entities = this.loadEntities(folder.project_id);
      const layout = this.loadLayoutState(folder.project_id, documents, entities);
      this.saveLayoutState(folder.project_id, {
        ...layout,
        expandedFolderIds: layout.expandedFolderIds.filter((folderId) => folderId !== input.folderId),
      });
      this.appendEvent("folder", input.folderId, "folderDeleted", 0, { title: folder.title });
      return this.loadWorkspace();
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  // BELOW → DocumentRepository.ts
  // createDocument, updateDocumentMeta, deleteDocument, reorderDocument,
  // openDocument
  //
  // deleteDocument cascades to slices + boundaries (cross-aggregate write);
  // keep that cascade inside the outer transaction when splitting — either
  // have DocumentRepository call SliceRepository.deleteSlicesForDocument(),
  // or let WorkspaceRepository compose both under one runInTransaction.
  // ══════════════════════════════════════════════════════════════════════
  createDocument(input: CreateDocumentInput): WorkspaceState {
    return this.sqliteHarness.runInTransaction(() => {
      const documentId = randomUUID();
      const ordering = this.nextDocumentOrdering(input.projectId, input.folderId);
      this.insertDocument({
        id: documentId,
        projectId: input.projectId,
        folderId: input.folderId,
        ordering,
        title: input.title.trim() || "Untitled Document",
        contentJson: buildEmptyDocumentJson(),
        plainText: "",
      });
      this.ensureCheckpoint(this.requireDocumentSnapshot(documentId), "document-created");

      const documents = this.loadDocumentSummaries(input.projectId);
      const entities = this.loadEntities(input.projectId);
      const layout = this.loadLayoutState(input.projectId, documents, entities);
      this.saveLayoutState(input.projectId, {
        ...layout,
        activeDocumentId: input.openInPanel ? layout.activeDocumentId : documentId,
        panelDocumentId: input.openInPanel ? documentId : layout.panelDocumentId,
        panelOpen: input.openInPanel ? true : layout.panelOpen,
        lastFocusedDocumentId: input.openInPanel ? layout.lastFocusedDocumentId : documentId,
        recentTargetDocumentIds: uniqueStrings([documentId, ...layout.recentTargetDocumentIds]).slice(0, 5),
      });

      this.appendEvent("document", documentId, "documentCreated", 0, {
        title: input.title.trim() || "Untitled Document",
        folderId: input.folderId,
      });
      return this.loadWorkspace();
    });
  }

  updateDocumentMeta(input: UpdateDocumentMetaInput): WorkspaceState {
    return this.sqliteHarness.runInTransaction(() => {
      const snapshot = this.requireDocumentSnapshot(input.documentId);
      const row = this.requireDocumentRow(input.documentId);
      const now = isoNow();
      let folderId = row.folder_id;
      let ordering = row.ordering;

      if (input.folderId !== undefined && input.folderId !== row.folder_id) {
        folderId = input.folderId;
        ordering = this.nextDocumentOrdering(row.project_id ?? DEFAULT_PROJECT_ID, folderId);
      }

      this.sqliteHarness.getConnection().prepare(`
        UPDATE documents
        SET title = ?, folder_id = ?, ordering = ?, updated_at = ?
        WHERE id = ?
      `).run(
        input.title ?? snapshot.title,
        folderId,
        ordering,
        now,
        input.documentId,
      );

      this.appendEvent("document", input.documentId, "documentMetaUpdated", row.current_version, {
        title: input.title ?? snapshot.title,
        folderId,
      });
      return this.loadWorkspace();
    });
  }

  deleteDocument(input: DeleteDocumentInput): WorkspaceState {
    return this.sqliteHarness.runInTransaction(() => {
      const database = this.sqliteHarness.getConnection();
      const row = this.requireDocumentRow(input.documentId);
      const sliceIds = database.prepare(`
        SELECT id
        FROM slices
        WHERE document_id = ?
      `).all(input.documentId) as Array<{ id: string }>;

      for (const slice of sliceIds) {
        this.deleteSliceInternal(slice.id);
      }

      database.prepare("DELETE FROM document_steps WHERE document_id = ?").run(input.documentId);
      database.prepare("DELETE FROM document_checkpoints WHERE document_id = ?").run(input.documentId);
      database.prepare("DELETE FROM documents WHERE id = ?").run(input.documentId);

      const documents = this.loadDocumentSummaries(row.project_id ?? DEFAULT_PROJECT_ID);
      const entities = this.loadEntities(row.project_id ?? DEFAULT_PROJECT_ID);
      const layout = this.loadLayoutState(row.project_id ?? DEFAULT_PROJECT_ID, documents, entities);
      const fallbackDocumentId = documents[0]?.id ?? null;
      this.saveLayoutState(row.project_id ?? DEFAULT_PROJECT_ID, {
        ...layout,
        activeDocumentId: layout.activeDocumentId === input.documentId ? fallbackDocumentId : layout.activeDocumentId,
        panelDocumentId: layout.panelDocumentId === input.documentId ? null : layout.panelDocumentId,
        lastFocusedDocumentId: layout.lastFocusedDocumentId === input.documentId ? fallbackDocumentId : layout.lastFocusedDocumentId,
        recentTargetDocumentIds: layout.recentTargetDocumentIds.filter((documentId) => documentId !== input.documentId),
      });
      this.appendEvent("document", input.documentId, "documentDeleted", row.current_version, { title: row.title });
      return this.loadWorkspace();
    });
  }

  reorderDocument(input: ReorderDocumentInput): WorkspaceState {
    return this.sqliteHarness.runInTransaction(() => {
      const current = this.requireDocumentRow(input.documentId);
      const siblings = this.loadDocumentRowsForFolder(current.project_id ?? DEFAULT_PROJECT_ID, current.folder_id);
      const index = siblings.findIndex((candidate) => candidate.id === input.documentId);
      if (index === -1) {
        return this.loadWorkspace();
      }

      const swapIndex = input.direction === "up" ? index - 1 : index + 1;
      const swapWith = siblings[swapIndex];
      if (!swapWith) {
        return this.loadWorkspace();
      }

      const database = this.sqliteHarness.getConnection();
      database.prepare("UPDATE documents SET ordering = ? WHERE id = ?").run(swapWith.ordering, current.id);
      database.prepare("UPDATE documents SET ordering = ? WHERE id = ?").run(current.ordering, swapWith.id);
      return this.loadWorkspace();
    });
  }

  openDocument(input: OpenDocumentInput): WorkspaceState {
    return this.sqliteHarness.runInTransaction(() => {
      const row = this.requireDocumentRow(input.documentId);
      const documents = this.loadDocumentSummaries(row.project_id ?? DEFAULT_PROJECT_ID);
      const entities = this.loadEntities(row.project_id ?? DEFAULT_PROJECT_ID);
      const layout = this.loadLayoutState(row.project_id ?? DEFAULT_PROJECT_ID, documents, entities);
      this.setActiveProjectId(row.project_id ?? DEFAULT_PROJECT_ID);
      this.saveLayoutState(row.project_id ?? DEFAULT_PROJECT_ID, {
        ...layout,
        activeDocumentId: input.surface === "main" ? input.documentId : layout.activeDocumentId,
        panelDocumentId: input.surface === "panel" ? input.documentId : layout.panelDocumentId,
        panelOpen: input.surface === "panel" ? true : layout.panelOpen,
        panelMode: input.surface === "panel" ? "document" : layout.panelMode,
        lastFocusedDocumentId: input.surface === "main" ? input.documentId : layout.lastFocusedDocumentId,
        recentTargetDocumentIds: uniqueStrings([input.documentId, ...layout.recentTargetDocumentIds]).slice(0, 5),
      });
      return this.loadWorkspace();
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  // BELOW → LayoutRepository.ts
  // updateLayout (paired with loadLayoutState / saveLayoutState private
  // helpers further down in this file)
  // ══════════════════════════════════════════════════════════════════════
  updateLayout(input: UpdateLayoutInput): WorkspaceState {
    return this.sqliteHarness.runInTransaction(() => {
      const activeProjectId = input.activeProjectId ?? this.requireActiveProjectId();
      const documents = this.loadDocumentSummaries(activeProjectId);
      const entities = this.loadEntities(activeProjectId);
      const layout = this.loadLayoutState(activeProjectId, documents, entities);
      this.saveLayoutState(activeProjectId, {
        ...layout,
        ...input,
        activeProjectId,
      });
      if (input.activeProjectId) {
        this.setActiveProjectId(input.activeProjectId);
      }
      return this.loadWorkspace();
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  // BELOW → HistoryRepository.ts (step + checkpoint path)
  // applyDocumentTransaction — the hottest mutation in the system.
  // It writes document_steps, updates the documents projection, calls
  // updateSliceBoundariesForDocument (SliceRepository), and periodically
  // triggers ensureCheckpoint. When splitting:
  //   - The step log write + document projection update belong to
  //     HistoryRepository / DocumentRepository.
  //   - The slice boundary re-anchor call is cross-aggregate; prefer
  //     SliceRepository.rewriteBoundariesAfterSteps(snapshot, serializedSteps)
  //     to keep the transform logic owned by Slice, with History holding
  //     only the trigger.
  //   - Keep the whole thing inside one runInTransaction — no split commits.
  // ══════════════════════════════════════════════════════════════════════
  applyDocumentTransaction(input: ApplyDocumentTransactionInput): ApplyDocumentTransactionResult {
    return this.sqliteHarness.runInTransaction(() => {
      const snapshot = this.requireDocumentSnapshot(input.documentId);
      if (snapshot.currentVersion !== input.baseVersion) {
        throw new Error(`Version mismatch. Expected ${snapshot.currentVersion}, received ${input.baseVersion}.`);
      }

      const database = this.sqliteHarness.getConnection();
      const now = isoNow();
      const nextVersion = input.baseVersion + input.steps.length;

      for (let index = 0; index < input.steps.length; index += 1) {
        const version = input.baseVersion + index + 1;
        database.prepare(`
          INSERT INTO document_steps (
            id,
            document_id,
            version,
            step_json,
            inverse_step_json,
            created_at
          )
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          randomUUID(),
          input.documentId,
          version,
          JSON.stringify(input.steps[index]),
          JSON.stringify(input.inverseSteps[index] ?? {}),
          now,
        );
      }

      database.prepare(`
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
      if (input.saveIntent || nextVersion % CHECKPOINT_INTERVAL === 0) {
        this.ensureCheckpoint(updatedSnapshot, input.saveIntent ? "explicit-save" : `auto-${nextVersion}`);
      }

      const sliceBoundaries = this.updateSliceBoundariesForDocument(updatedSnapshot, input.steps);
      return {
        snapshot: updatedSnapshot,
        summary: this.requireDocumentSummary(input.documentId),
        sliceBoundaries,
        historySummary: this.loadHistorySummary(input.documentId),
      };
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  // BELOW → EntityRepository.ts
  // createEntity, updateEntity, deleteEntity, upsertMatchingRule,
  // deleteMatchingRule
  //
  // deleteEntity cascades through matching_rules, entity_slices, slices,
  // and slice_boundaries — same cross-aggregate transaction rule as
  // deleteDocument applies.
  // ══════════════════════════════════════════════════════════════════════
  createEntity(input: CreateEntityInput): WorkspaceState {
    return this.sqliteHarness.runInTransaction(() => {
      const now = isoNow();
      const entityId = randomUUID();
      this.sqliteHarness.getConnection().prepare(`
        INSERT INTO entities (id, project_id, name, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(entityId, input.projectId, input.name.trim() || "Untitled Entity", now, now);

      const documents = this.loadDocumentSummaries(input.projectId);
      const entities = this.loadEntities(input.projectId);
      const layout = this.loadLayoutState(input.projectId, documents, entities);
      this.saveLayoutState(input.projectId, {
        ...layout,
        selectedEntityId: entityId,
        panelOpen: true,
        panelMode: "entities",
      });
      this.appendEvent("entity", entityId, "entityCreated", 0, { name: input.name.trim() || "Untitled Entity" });
      return this.loadWorkspace();
    });
  }

  updateEntity(input: UpdateEntityInput): WorkspaceState {
    return this.sqliteHarness.runInTransaction(() => {
      this.sqliteHarness.getConnection().prepare(`
        UPDATE entities
        SET name = ?, updated_at = ?
        WHERE id = ?
      `).run(input.name.trim() || "Untitled Entity", isoNow(), input.entityId);
      this.appendEvent("entity", input.entityId, "entityUpdated", 0, { name: input.name.trim() || "Untitled Entity" });
      return this.loadWorkspace();
    });
  }

  deleteEntity(input: DeleteEntityInput): WorkspaceState {
    return this.sqliteHarness.runInTransaction(() => {
      const database = this.sqliteHarness.getConnection();
      const entity = database.prepare(`
        SELECT id, project_id, name, created_at, updated_at
        FROM entities
        WHERE id = ?
      `).get(input.entityId) as RawEntityRow | undefined;
      if (!entity) {
        return this.loadWorkspace();
      }

      const sliceRows = database.prepare(`
        SELECT slice_id
        FROM entity_slices
        WHERE entity_id = ?
      `).all(input.entityId) as Array<{ slice_id: string }>;

      database.prepare("DELETE FROM matching_rules WHERE entity_id = ?").run(input.entityId);
      database.prepare("DELETE FROM entity_slices WHERE entity_id = ?").run(input.entityId);
      database.prepare("DELETE FROM entities WHERE id = ?").run(input.entityId);

      for (const row of sliceRows) {
        const stillReferenced = database.prepare(`
          SELECT 1
          FROM entity_slices
          WHERE slice_id = ?
          LIMIT 1
        `).get(row.slice_id) as { 1: number } | undefined;
        if (!stillReferenced) {
          this.deleteSliceInternal(row.slice_id);
        }
      }

      const documents = this.loadDocumentSummaries(entity.project_id);
      const entities = this.loadEntities(entity.project_id);
      const layout = this.loadLayoutState(entity.project_id, documents, entities);
      this.saveLayoutState(entity.project_id, {
        ...layout,
        selectedEntityId: layout.selectedEntityId === input.entityId ? entities[0]?.id ?? null : layout.selectedEntityId,
      });
      this.appendEvent("entity", input.entityId, "entityDeleted", 0, { name: entity.name });
      return this.loadWorkspace();
    });
  }

  upsertMatchingRule(input: UpsertMatchingRuleInput): WorkspaceState {
    return this.sqliteHarness.runInTransaction(() => {
      const now = isoNow();
      const id = input.id ?? randomUUID();
      const createdAt = input.id
        ? (this.sqliteHarness.getConnection().prepare("SELECT created_at FROM matching_rules WHERE id = ?").get(id) as { created_at: string | null } | undefined)?.created_at ?? now
        : now;

      this.sqliteHarness.getConnection().prepare(`
        INSERT INTO matching_rules (
          id,
          entity_id,
          label,
          kind,
          pattern,
          whole_word,
          allow_possessive,
          enabled,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          entity_id = excluded.entity_id,
          label = excluded.label,
          kind = excluded.kind,
          pattern = excluded.pattern,
          whole_word = excluded.whole_word,
          allow_possessive = excluded.allow_possessive,
          enabled = excluded.enabled,
          updated_at = excluded.updated_at
      `).run(
        id,
        input.entityId,
        input.label,
        input.kind,
        input.pattern,
        boolToInt(input.wholeWord),
        boolToInt(input.allowPossessive),
        boolToInt(input.enabled),
        createdAt,
        now,
      );

      this.appendEvent("matchingRule", id, input.id ? "matchingRuleUpdated" : "matchingRuleCreated", 0, {
        entityId: input.entityId,
        label: input.label,
        kind: input.kind,
        pattern: input.pattern,
      });
      return this.loadWorkspace();
    });
  }

  deleteMatchingRule(input: DeleteMatchingRuleInput): WorkspaceState {
    return this.sqliteHarness.runInTransaction(() => {
      this.sqliteHarness.getConnection().prepare("DELETE FROM matching_rules WHERE id = ?").run(input.ruleId);
      return this.loadWorkspace();
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  // BELOW → SliceRepository.ts
  // createSlice, deleteSlice
  //
  // createSlice reads a document snapshot and builds a TextAnchor via
  // buildAnchorFromRange (src/db/anchoring.ts after split). Split keeps
  // the anchor-construction call here; the math lives in anchoring.ts.
  // ══════════════════════════════════════════════════════════════════════
  createSlice(input: CreateSliceInput): WorkspaceState {
    return this.sqliteHarness.runInTransaction(() => {
      const now = isoNow();
      const sliceId = randomUUID();
      const boundaryId = randomUUID();
      const excerpt = truncate(input.anchor.exact, 180);
      const resolution: AnchorResolutionResult = {
        status: "resolved",
        reason: "captured from committed slice placement",
        anchor: input.anchor,
      };

      this.sqliteHarness.getConnection().prepare(`
        INSERT INTO slice_boundaries (
          id,
          slice_id,
          document_id,
          anchor_json,
          resolution_status,
          resolution_reason,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        boundaryId,
        sliceId,
        input.documentId,
        JSON.stringify(input.anchor),
        resolution.status,
        resolution.reason,
        now,
        now,
      );

      this.sqliteHarness.getConnection().prepare(`
        INSERT INTO slices (
          id,
          project_id,
          document_id,
          boundary_id,
          title,
          excerpt,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        sliceId,
        input.projectId,
        input.documentId,
        boundaryId,
        input.title.trim() || truncate(input.anchor.exact, 42),
        excerpt,
        now,
        now,
      );

      const nextOrdering = this.nextEntitySliceOrdering(input.entityId);
      this.sqliteHarness.getConnection().prepare(`
        INSERT INTO entity_slices (entity_id, slice_id, ordering)
        VALUES (?, ?, ?)
      `).run(input.entityId, sliceId, nextOrdering);

      const documents = this.loadDocumentSummaries(input.projectId);
      const entities = this.loadEntities(input.projectId);
      const layout = this.loadLayoutState(input.projectId, documents, entities);
      this.saveLayoutState(input.projectId, {
        ...layout,
        selectedEntityId: input.entityId,
        panelOpen: true,
        panelMode: "document",
        panelDocumentId: input.documentId,
        recentTargetDocumentIds: uniqueStrings([input.documentId, ...layout.recentTargetDocumentIds]).slice(0, 5),
      });

      this.appendEvent("slice", sliceId, "sliceCreated", input.anchor.versionSeen, {
        entityId: input.entityId,
        title: input.title,
        documentId: input.documentId,
      });
      return this.loadWorkspace();
    });
  }

  deleteSlice(input: DeleteSliceInput): WorkspaceState {
    return this.sqliteHarness.runInTransaction(() => {
      this.deleteSliceInternal(input.sliceId);
      return this.loadWorkspace();
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  // BELOW → HistoryRepository.ts (continued)
  // writeCheckpoint, replayDocumentToVersion, loadHistorySummary
  // ══════════════════════════════════════════════════════════════════════
  writeCheckpoint(documentId: string, label: string | null): void {
    this.sqliteHarness.runInTransaction(() => {
      this.ensureCheckpoint(this.requireDocumentSnapshot(documentId), label);
    });
  }

  replayDocumentToVersion(documentId: string, targetVersion: number): WorkspaceDocumentReplayResult {
    const snapshot = replaySnapshotToVersion(this.sqliteHarness.getConnection(), documentId, targetVersion);
    const sliceBoundaries = this.loadSliceBoundariesForDocument(documentId).map((boundary) => ({
      ...boundary,
      resolution: {
        ...boundary.resolution,
        anchor: { ...boundary.resolution.anchor, versionSeen: targetVersion },
      },
    }));
    return {
      snapshot,
      sliceBoundaries,
    };
  }

  loadHistorySummary(documentId: string): HistorySummary {
    const counts = this.sqliteHarness.getConnection().prepare(`
      SELECT
        (SELECT COUNT(*) FROM document_steps WHERE document_id = ?) AS stepCount,
        (SELECT COUNT(*) FROM document_checkpoints WHERE document_id = ?) AS checkpointCount
    `).get(documentId, documentId) as RawHistoryCountRow;

    const document = this.requireDocumentSnapshot(documentId);
    const eventCounts = this.sqliteHarness.getConnection().prepare(`
      SELECT COUNT(*) AS eventCount
      FROM events
    `).get() as RawEventCountRow;

    return {
      currentVersion: document.currentVersion,
      stepCount: counts.stepCount,
      checkpointCount: counts.checkpointCount,
      eventCount: eventCounts.eventCount,
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  // BELOW → WorkspaceRepository.ts (private seed bootstrap) + per-aggregate
  // loaders. Each loadXxx() method moves to the repository that owns its
  // aggregate; WorkspaceRepository.loadWorkspace() composes the results.
  // ══════════════════════════════════════════════════════════════════════
  private ensureSeedState(): void {
    const database = this.sqliteHarness.getConnection();
    const now = isoNow();
    const projects = database.prepare("SELECT id FROM projects ORDER BY created_at ASC").all() as Array<{ id: string }>;

    if (projects.length === 0) {
      database.prepare(`
        INSERT INTO projects (id, name, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `).run(DEFAULT_PROJECT_ID, DEFAULT_PROJECT_NAME, now, now);
    }

    const activeProjectId = this.loadActiveProjectId() ?? DEFAULT_PROJECT_ID;
    this.setActiveProjectId(activeProjectId);

    const folderExists = database.prepare(`
      SELECT id
      FROM document_folders
      WHERE project_id = ?
      LIMIT 1
    `).get(activeProjectId) as { id: string } | undefined;

    if (!folderExists) {
      this.insertFolder({
        id: DEFAULT_FOLDER_ID,
        projectId: activeProjectId,
        parentFolderId: null,
        title: "Story",
        ordering: 0,
        createdAt: now,
        updatedAt: now,
      });
    }

    const legacyDocs = database.prepare(`
      SELECT id, updated_at
      FROM documents
      WHERE project_id IS NULL OR created_at IS NULL
      ORDER BY updated_at ASC
    `).all() as Array<{ id: string; updated_at: string }>;

    legacyDocs.forEach((row, index) => {
      database.prepare(`
        UPDATE documents
        SET
          project_id = COALESCE(project_id, ?),
          folder_id = COALESCE(folder_id, ?),
          ordering = CASE WHEN ordering = 0 THEN ? ELSE ordering END,
          created_at = COALESCE(created_at, updated_at)
        WHERE id = ?
      `).run(activeProjectId, DEFAULT_FOLDER_ID, index, row.id);
    });

    const documents = database.prepare(`
      SELECT id
      FROM documents
      WHERE project_id = ?
      ORDER BY ordering ASC, updated_at ASC
    `).all(activeProjectId) as Array<{ id: string }>;

    if (documents.length === 0) {
      this.insertDocument({
        id: DEFAULT_STORY_DOCUMENT_ID,
        projectId: activeProjectId,
        folderId: DEFAULT_FOLDER_ID,
        ordering: 0,
        title: DEFAULT_STORY_DOCUMENT_TITLE,
        contentJson: buildEmptyDocumentJson(),
        plainText: "",
      });
      this.ensureCheckpoint(this.requireDocumentSnapshot(DEFAULT_STORY_DOCUMENT_ID), "initial-head");
    }

    const orphanRules = database.prepare(`
      SELECT id, label, updated_at
      FROM matching_rules
      WHERE entity_id IS NULL
      ORDER BY updated_at ASC
    `).all() as Array<{ id: string; label: string; updated_at: string }>;

    orphanRules.forEach((rule) => {
      const entityId = randomUUID();
      database.prepare(`
        INSERT INTO entities (id, project_id, name, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(entityId, activeProjectId, rule.label || "Imported Entity", rule.updated_at, rule.updated_at);
      database.prepare(`
        UPDATE matching_rules
        SET entity_id = ?, created_at = COALESCE(created_at, updated_at)
        WHERE id = ?
      `).run(entityId, rule.id);
    });

    this.loadLayoutState(activeProjectId, this.loadDocumentSummaries(activeProjectId), this.loadEntities(activeProjectId));
  }

  private loadProjects(): ProjectRecord[] {
    const rows = this.sqliteHarness.getConnection().prepare(`
      SELECT id, name, created_at, updated_at
      FROM projects
      ORDER BY updated_at DESC, created_at ASC
    `).all() as RawProjectRow[];

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  private loadFolders(projectId: string): DocumentFolderRecord[] {
    const rows = this.sqliteHarness.getConnection().prepare(`
      SELECT id, project_id, parent_folder_id, title, ordering, created_at, updated_at
      FROM document_folders
      WHERE project_id = ?
      ORDER BY ordering ASC, title COLLATE NOCASE ASC
    `).all(projectId) as RawFolderRow[];

    return rows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      parentFolderId: row.parent_folder_id,
      title: row.title,
      ordering: row.ordering,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  private loadDocumentSummaries(projectId: string): DocumentSummary[] {
    const rows = this.sqliteHarness.getConnection().prepare(`
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

  private loadEntities(projectId: string): EntityRecord[] {
    const rows = this.sqliteHarness.getConnection().prepare(`
      SELECT id, project_id, name, created_at, updated_at
      FROM entities
      WHERE project_id = ?
      ORDER BY updated_at DESC, name COLLATE NOCASE ASC
    `).all(projectId) as RawEntityRow[];

    return rows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  private loadMatchingRulesForProject(projectId: string): MatchingRuleRecord[] {
    const rows = this.sqliteHarness.getConnection().prepare(`
      SELECT
        matching_rules.id,
        matching_rules.entity_id,
        matching_rules.label,
        matching_rules.kind,
        matching_rules.pattern,
        matching_rules.whole_word,
        matching_rules.allow_possessive,
        matching_rules.enabled,
        matching_rules.created_at,
        matching_rules.updated_at
      FROM matching_rules
      INNER JOIN entities ON entities.id = matching_rules.entity_id
      WHERE entities.project_id = ?
      ORDER BY matching_rules.updated_at DESC, matching_rules.label COLLATE NOCASE ASC
    `).all(projectId) as RawMatchingRuleRow[];

    return rows.flatMap((row) => row.entity_id ? [{
      id: row.id,
      entityId: row.entity_id,
      label: row.label,
      kind: row.kind as MatchingRuleRecord["kind"],
      pattern: row.pattern,
      wholeWord: intToBool(row.whole_word),
      allowPossessive: intToBool(row.allow_possessive),
      enabled: intToBool(row.enabled),
      createdAt: row.created_at ?? row.updated_at,
      updatedAt: row.updated_at,
    }] : []);
  }

  private loadSlices(projectId: string): SliceRecord[] {
    const rows = this.sqliteHarness.getConnection().prepare(`
      SELECT id, project_id, document_id, boundary_id, title, excerpt, created_at, updated_at
      FROM slices
      WHERE project_id = ?
      ORDER BY updated_at DESC, created_at DESC
    `).all(projectId) as RawSliceRow[];

    return rows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      documentId: row.document_id,
      boundaryId: row.boundary_id,
      title: row.title,
      excerpt: row.excerpt,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  private loadSliceBoundariesForProject(projectId: string): SliceBoundaryRecord[] {
    const rows = this.sqliteHarness.getConnection().prepare(`
      SELECT
        slice_boundaries.id,
        slice_boundaries.slice_id,
        slice_boundaries.document_id,
        slice_boundaries.anchor_json,
        slice_boundaries.resolution_status,
        slice_boundaries.resolution_reason,
        slice_boundaries.created_at,
        slice_boundaries.updated_at
      FROM slice_boundaries
      INNER JOIN slices ON slices.id = slice_boundaries.slice_id
      WHERE slices.project_id = ?
      ORDER BY slice_boundaries.updated_at DESC
    `).all(projectId) as RawSliceBoundaryRow[];

    return rows.map(mapSliceBoundaryRecord);
  }

  private loadSliceBoundariesForDocument(documentId: string): SliceBoundaryRecord[] {
    const rows = this.sqliteHarness.getConnection().prepare(`
      SELECT id, slice_id, document_id, anchor_json, resolution_status, resolution_reason, created_at, updated_at
      FROM slice_boundaries
      WHERE document_id = ?
      ORDER BY updated_at DESC
    `).all(documentId) as RawSliceBoundaryRow[];

    return rows.map(mapSliceBoundaryRecord);
  }

  private loadEntitySlices(projectId: string): EntitySliceRecord[] {
    const rows = this.sqliteHarness.getConnection().prepare(`
      SELECT entity_slices.entity_id, entity_slices.slice_id, entity_slices.ordering
      FROM entity_slices
      INNER JOIN entities ON entities.id = entity_slices.entity_id
      WHERE entities.project_id = ?
      ORDER BY entity_slices.ordering ASC
    `).all(projectId) as RawEntitySliceRow[];

    return rows.map((row) => ({
      entityId: row.entity_id,
      sliceId: row.slice_id,
      ordering: row.ordering,
    }));
  }

  private loadDocumentSnapshot(documentId: string): StoredDocumentSnapshot | null {
    const row = this.sqliteHarness.getConnection().prepare(`
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

    return row ? mapDocumentRow(row) : null;
  }

  private requireDocumentSnapshot(documentId: string): StoredDocumentSnapshot {
    const snapshot = this.loadDocumentSnapshot(documentId);
    if (!snapshot) {
      throw new Error(`Missing document ${documentId}.`);
    }
    return snapshot;
  }

  private requireDocumentSummary(documentId: string): DocumentSummary {
    const row = this.requireDocumentRow(documentId);
    return mapDocumentSummary(row);
  }

  private requireDocumentRow(documentId: string): RawDocumentRow {
    const row = this.sqliteHarness.getConnection().prepare(`
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

    if (!row) {
      throw new Error(`Missing document ${documentId}.`);
    }

    return row;
  }

  // ── BELOW → LayoutRepository.ts (private helpers) ──
  // loadLayoutState, saveLayoutState
  private loadLayoutState(
    projectId: string,
    documents: DocumentSummary[],
    entities: EntityRecord[],
  ): WorkspaceLayoutState {
    const database = this.sqliteHarness.getConnection();
    const row = database.prepare(`
      SELECT
        project_id,
        active_document_id,
        panel_document_id,
        selected_entity_id,
        expanded_folder_ids_json,
        highlights_enabled,
        panel_open,
        panel_mode,
        last_focused_document_id,
        recent_target_document_ids_json,
        updated_at
      FROM workspace_layout_state
      WHERE project_id = ?
    `).get(projectId) as RawLayoutRow | undefined;

    const defaultLayout: WorkspaceLayoutState = {
      activeProjectId: projectId,
      activeDocumentId: documents[0]?.id ?? null,
      panelDocumentId: null,
      selectedEntityId: entities[0]?.id ?? null,
      expandedFolderIds: this.loadFolders(projectId).map((folder) => folder.id),
      highlightsEnabled: true,
      panelOpen: true,
      panelMode: "entities",
      lastFocusedDocumentId: documents[0]?.id ?? null,
      recentTargetDocumentIds: documents[0]?.id ? [documents[0].id] : [],
    };

    if (!row) {
      this.saveLayoutState(projectId, defaultLayout);
      return defaultLayout;
    }

    const layout: WorkspaceLayoutState = {
      activeProjectId: projectId,
      activeDocumentId: row.active_document_id ?? defaultLayout.activeDocumentId,
      panelDocumentId: row.panel_document_id,
      selectedEntityId: row.selected_entity_id ?? defaultLayout.selectedEntityId,
      expandedFolderIds: safeParseStringArray(row.expanded_folder_ids_json, defaultLayout.expandedFolderIds),
      highlightsEnabled: intToBool(row.highlights_enabled),
      panelOpen: intToBool(row.panel_open),
      panelMode: row.panel_mode as WorkspaceLayoutState["panelMode"],
      lastFocusedDocumentId: row.last_focused_document_id ?? defaultLayout.lastFocusedDocumentId,
      recentTargetDocumentIds: safeParseStringArray(row.recent_target_document_ids_json, defaultLayout.recentTargetDocumentIds),
    };

    if (layout.activeDocumentId === null && documents[0]) {
      const repaired = {
        ...layout,
        activeDocumentId: documents[0].id,
        lastFocusedDocumentId: documents[0].id,
      };
      this.saveLayoutState(projectId, repaired);
      return repaired;
    }

    return layout;
  }

  private saveLayoutState(projectId: string, layout: WorkspaceLayoutState): void {
    this.sqliteHarness.getConnection().prepare(`
      INSERT INTO workspace_layout_state (
        project_id,
        active_document_id,
        panel_document_id,
        selected_entity_id,
        expanded_folder_ids_json,
        highlights_enabled,
        panel_open,
        panel_mode,
        last_focused_document_id,
        recent_target_document_ids_json,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(project_id) DO UPDATE SET
        active_document_id = excluded.active_document_id,
        panel_document_id = excluded.panel_document_id,
        selected_entity_id = excluded.selected_entity_id,
        expanded_folder_ids_json = excluded.expanded_folder_ids_json,
        highlights_enabled = excluded.highlights_enabled,
        panel_open = excluded.panel_open,
        panel_mode = excluded.panel_mode,
        last_focused_document_id = excluded.last_focused_document_id,
        recent_target_document_ids_json = excluded.recent_target_document_ids_json,
        updated_at = excluded.updated_at
    `).run(
      projectId,
      layout.activeDocumentId,
      layout.panelDocumentId,
      layout.selectedEntityId,
      JSON.stringify(layout.expandedFolderIds),
      boolToInt(layout.highlightsEnabled),
      boolToInt(layout.panelOpen),
      layout.panelMode,
      layout.lastFocusedDocumentId,
      JSON.stringify(layout.recentTargetDocumentIds),
      isoNow(),
    );
  }

  // ── BELOW → ProjectRepository.ts (private helpers) ──
  // requireActiveProjectId, loadActiveProjectId, setActiveProjectId
  private requireActiveProjectId(): string {
    return this.loadActiveProjectId() ?? DEFAULT_PROJECT_ID;
  }

  private loadActiveProjectId(): string | null {
    const row = this.sqliteHarness.getConnection().prepare(`
      SELECT value_json
      FROM app_state
      WHERE key = 'activeProjectId'
    `).get() as { value_json: string } | undefined;

    if (!row) {
      return null;
    }

    try {
      const parsed = JSON.parse(row.value_json) as { projectId?: string };
      return parsed.projectId ?? null;
    } catch {
      return null;
    }
  }

  private setActiveProjectId(projectId: string): void {
    this.sqliteHarness.getConnection().prepare(`
      INSERT INTO app_state (key, value_json)
      VALUES ('activeProjectId', ?)
      ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json
    `).run(JSON.stringify({ projectId }));
  }

  // ── BELOW → FolderRepository.ts + DocumentRepository.ts (insert helpers) ──
  // insertFolder belongs with FolderRepository; insertDocument belongs with
  // DocumentRepository. nextFolderOrdering / nextDocumentOrdering likewise.
  private insertFolder(input: {
    id: string;
    projectId: string;
    parentFolderId: string | null;
    title: string;
    ordering: number;
    createdAt: string;
    updatedAt: string;
  }): void {
    this.sqliteHarness.getConnection().prepare(`
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

  private insertDocument(input: {
    id: string;
    projectId: string;
    folderId: string | null;
    ordering: number;
    title: string;
    contentJson: JsonObject;
    plainText: string;
  }): void {
    const now = isoNow();
    this.sqliteHarness.getConnection().prepare(`
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

  // ── BELOW → HistoryRepository.ts (checkpoint helper) ──
  private ensureCheckpoint(snapshot: StoredDocumentSnapshot, label: string | null): void {
    this.sqliteHarness.getConnection().prepare(`
      INSERT OR REPLACE INTO document_checkpoints (
        document_id,
        version,
        content_format,
        content_schema_version,
        content_json,
        plain_text,
        label,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      snapshot.id,
      snapshot.currentVersion,
      snapshot.contentFormat,
      snapshot.contentSchemaVersion,
      JSON.stringify(snapshot.contentJson),
      snapshot.plainText,
      label,
      isoNow(),
    );
  }

  private nextFolderOrdering(projectId: string): number {
    const row = this.sqliteHarness.getConnection().prepare(`
      SELECT COALESCE(MAX(ordering), -1) AS ordering
      FROM document_folders
      WHERE project_id = ?
    `).get(projectId) as { ordering: number };
    return row.ordering + 1;
  }

  private nextDocumentOrdering(projectId: string, folderId: string | null): number {
    const row = this.sqliteHarness.getConnection().prepare(`
      SELECT COALESCE(MAX(ordering), -1) AS ordering
      FROM documents
      WHERE project_id = ?
        AND folder_id IS ?
    `).get(projectId, folderId) as { ordering: number };
    return row.ordering + 1;
  }

  // ── BELOW → SliceRepository.ts (private helpers) ──
  // nextEntitySliceOrdering, loadDocumentRowsForFolder (note: last one is
  // used only by deleteFolder cascade — move with FolderRepository instead),
  // deleteSliceInternal, updateSliceBoundariesForDocument.
  private nextEntitySliceOrdering(entityId: string): number {
    const row = this.sqliteHarness.getConnection().prepare(`
      SELECT COALESCE(MAX(ordering), -1) AS ordering
      FROM entity_slices
      WHERE entity_id = ?
    `).get(entityId) as { ordering: number };
    return row.ordering + 1;
  }

  private loadDocumentRowsForFolder(projectId: string, folderId: string | null): RawDocumentRow[] {
    return this.sqliteHarness.getConnection().prepare(`
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

  private deleteSliceInternal(sliceId: string): void {
    const database = this.sqliteHarness.getConnection();
    database.prepare("DELETE FROM entity_slices WHERE slice_id = ?").run(sliceId);
    database.prepare("DELETE FROM slice_boundaries WHERE slice_id = ?").run(sliceId);
    database.prepare("DELETE FROM slices WHERE id = ?").run(sliceId);
  }

  private updateSliceBoundariesForDocument(
    snapshot: StoredDocumentSnapshot,
    serializedSteps: JsonObject[],
  ): SliceBoundaryRecord[] {
    const boundaries = this.loadSliceBoundariesForDocument(snapshot.id);
    if (boundaries.length === 0 || serializedSteps.length === 0) {
      return boundaries;
    }

    const database = this.sqliteHarness.getConnection();
    const nextDoc = basicSchema.nodeFromJSON(snapshot.contentJson);
    const mapping = createMappingFromSteps(serializedSteps);
    const updatedAt = isoNow();

    for (const boundary of boundaries) {
      const nextResolution = mapBoundaryForward(
        boundary.anchor,
        mapping,
        nextDoc,
        snapshot.currentVersion,
      );
      const changed =
        nextResolution.status !== boundary.resolution.status
        || nextResolution.reason !== boundary.resolution.reason
        || stableStringify(nextResolution.anchor) !== stableStringify(boundary.anchor);

      if (!changed) {
        continue;
      }

      database.prepare(`
        UPDATE slice_boundaries
        SET
          anchor_json = ?,
          resolution_status = ?,
          resolution_reason = ?,
          updated_at = ?
        WHERE id = ?
      `).run(
        JSON.stringify(nextResolution.anchor),
        nextResolution.status,
        nextResolution.reason,
        updatedAt,
        boundary.id,
      );

      this.appendEvent("sliceBoundary", boundary.id, "sliceBoundaryAutoResolved", snapshot.currentVersion, {
        sliceId: boundary.sliceId,
        status: nextResolution.status,
        reason: nextResolution.reason,
      });
    }

    return this.loadSliceBoundariesForDocument(snapshot.id);
  }

  // ── BELOW → HistoryRepository.ts (event-log primitive) ──
  // appendEvent is called from every mutation in every aggregate. After the
  // split, each repository takes a HistoryRepository reference and calls
  // history.appendEvent(...). It stays a single write path so event sequence
  // numbering is consistent across aggregates.
  private appendEvent(
    aggregateType: string,
    aggregateId: string,
    eventType: string,
    eventVersion: number,
    payload: JsonObject,
  ): EventRow {
    const database = this.sqliteHarness.getConnection();
    const aggregateSeqRow = database.prepare(`
      SELECT COALESCE(MAX(aggregate_seq), 0) AS seq
      FROM events
      WHERE aggregate_type = ? AND aggregate_id = ?
    `).get(aggregateType, aggregateId) as { seq: number };

    const event: EventRow = {
      id: randomUUID(),
      aggregateType,
      aggregateId,
      aggregateSeq: aggregateSeqRow.seq + 1,
      eventType,
      eventVersion,
      payloadJson: JSON.stringify(payload),
      createdAt: isoNow(),
    };

    database.prepare(`
      INSERT INTO events (
        id,
        aggregate_type,
        aggregate_id,
        aggregate_seq,
        event_type,
        event_version,
        payload_json,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      event.id,
      event.aggregateType,
      event.aggregateId,
      event.aggregateSeq,
      event.eventType,
      event.eventVersion,
      event.payloadJson,
      event.createdAt,
    );

    return event;
  }
}

// ══════════════════════════════════════════════════════════════════════════
// BELOW → src/db/rowMappers.ts (or colocate each with its owning repository)
// Pure row-to-domain decoders. No DB access, no mutation.
// ══════════════════════════════════════════════════════════════════════════
function mapDocumentSummary(row: RawDocumentRow): DocumentSummary {
  const metrics = collectDocumentMetrics(row.plain_text);
  return {
    id: row.id,
    projectId: row.project_id ?? DEFAULT_PROJECT_ID,
    folderId: row.folder_id,
    title: row.title,
    ordering: row.ordering,
    wordCount: metrics.wordCount,
    characterCount: metrics.characterCount,
    paragraphCount: metrics.paragraphCount,
    createdAt: row.created_at ?? row.updated_at,
    updatedAt: row.updated_at,
  };
}

function mapDocumentRow(row: RawDocumentRow): StoredDocumentSnapshot {
  return {
    id: row.id,
    title: row.title,
    contentFormat: row.content_format,
    contentSchemaVersion: row.content_schema_version,
    contentJson: JSON.parse(row.content_json) as StoredDocumentSnapshot["contentJson"],
    plainText: row.plain_text,
    currentVersion: row.current_version,
    updatedAt: row.updated_at,
  };
}

function mapSliceBoundaryRecord(row: RawSliceBoundaryRow): SliceBoundaryRecord {
  return {
    id: row.id,
    sliceId: row.slice_id,
    documentId: row.document_id,
    anchor: JSON.parse(row.anchor_json) as TextAnchor,
    resolution: {
      status: row.resolution_status as AnchorResolutionResult["status"],
      reason: row.resolution_reason,
      anchor: JSON.parse(row.anchor_json) as TextAnchor,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function buildEmptyDocumentJson(): JsonObject {
  return {
    type: "doc",
    content: [{ type: "paragraph" }],
  };
}

// ══════════════════════════════════════════════════════════════════════════
// BELOW → HistoryRepository.ts (replay path, free-function form)
// replaySnapshotToVersion, createMappingFromSteps. These take a Database
// handle as first arg today; after split they become private methods on
// HistoryRepository that use this.sqliteHarness.getConnection().
// ══════════════════════════════════════════════════════════════════════════
function replaySnapshotToVersion(
  database: BetterSqlite3.Database,
  documentId: string,
  targetVersion: number,
): StoredDocumentSnapshot {
  const checkpoint = database.prepare(`
    SELECT
      document_id,
      version,
      content_format,
      content_schema_version,
      content_json,
      plain_text,
      label,
      created_at
    FROM document_checkpoints
    WHERE document_id = ?
      AND version <= ?
    ORDER BY version DESC
    LIMIT 1
  `).get(documentId, targetVersion) as RawCheckpointRow | undefined;

  if (!checkpoint) {
    throw new Error(`No checkpoint found at or before version ${targetVersion}.`);
  }

  let doc = basicSchema.nodeFromJSON(JSON.parse(checkpoint.content_json) as JsonObject);
  const stepRows = database.prepare(`
    SELECT id, document_id, version, step_json, inverse_step_json, created_at
    FROM document_steps
    WHERE document_id = ?
      AND version > ?
      AND version <= ?
    ORDER BY version ASC
  `).all(documentId, checkpoint.version, targetVersion) as RawStepRow[];

  for (const row of stepRows) {
    const step = Step.fromJSON(basicSchema, JSON.parse(row.step_json) as JsonObject);
    const result = step.apply(doc);
    if (result.failed) {
      throw new Error(`Failed to replay step ${row.id}: ${result.failed}`);
    }
    doc = result.doc!;
  }

  const currentRow = database.prepare(`
    SELECT title, updated_at
    FROM documents
    WHERE id = ?
  `).get(documentId) as { title: string; updated_at: string } | undefined;

  return {
    id: documentId,
    title: currentRow?.title ?? DEFAULT_STORY_DOCUMENT_TITLE,
    contentFormat: HARNESS_CONTENT_FORMAT,
    contentSchemaVersion: HARNESS_CONTENT_SCHEMA_VERSION,
    contentJson: doc.toJSON() as JsonObject,
    plainText: serializeNodePlainText(doc),
    currentVersion: targetVersion,
    updatedAt: currentRow?.updated_at ?? checkpoint.created_at,
  };
}

function createMappingFromSteps(serializedSteps: JsonObject[]): Mapping {
  const mapping = new Mapping();
  for (const serializedStep of serializedSteps) {
    const step = Step.fromJSON(basicSchema, serializedStep);
    mapping.appendMap(step.getMap());
  }
  return mapping;
}

// ══════════════════════════════════════════════════════════════════════════
// BELOW → src/db/anchoring.ts
// Pure functions over ProseMirror documents. No DB access.
// This is load-bearing algorithmic code — extract it and add unit tests
// (see refineCode.md §A1 priority 2) before anything else changes here.
//
// Moves: mapBoundaryForward, resolveAnchorWithFallback, buildPlainTextIndex,
// walkNodeText, offsetToPosition, buildAnchorFromRange, resolveBlockPath,
// serializeNodePlainText.
// ══════════════════════════════════════════════════════════════════════════
function mapBoundaryForward(
  anchor: TextAnchor,
  mapping: Mapping,
  nextDoc: ProseMirrorNode,
  nextVersion: number,
): AnchorResolutionResult {
  const mappedFrom = mapping.map(anchor.from, 1);
  const mappedTo = mapping.map(anchor.to, -1);

  if (mappedFrom < mappedTo) {
    const mappedExact = nextDoc.textBetween(mappedFrom, mappedTo, "\n\n");
    const nextAnchor = buildAnchorFromRange(nextDoc, mappedFrom, mappedTo, anchor.documentId, nextVersion);
    return {
      status: "resolved",
      reason: mappedExact === anchor.exact
        ? "slice boundary mapped forward through document steps"
        : "slice boundary absorbed edits inside the tracked range",
      anchor: nextAnchor,
    };
  }

  return resolveAnchorWithFallback(anchor, nextDoc, "slice boundary mapping no longer matched exact text", nextVersion);
}

function resolveAnchorWithFallback(
  anchor: TextAnchor,
  nextDoc: ProseMirrorNode,
  fallbackReason: string,
  nextVersion: number,
): AnchorResolutionResult {
  const index = buildPlainTextIndex(nextDoc);
  const exact = anchor.exact;
  const candidates: Array<{ startOffset: number; score: number }> = [];

  let searchIndex = 0;
  while (searchIndex <= index.text.length) {
    const foundAt = index.text.indexOf(exact, searchIndex);
    if (foundAt === -1) {
      break;
    }

    const prefixSlice = index.text.slice(Math.max(0, foundAt - anchor.prefix.length), foundAt);
    const suffixSlice = index.text.slice(foundAt + exact.length, foundAt + exact.length + anchor.suffix.length);
    const prefixMatch = anchor.prefix.length === 0 || prefixSlice.endsWith(anchor.prefix);
    const suffixMatch = anchor.suffix.length === 0 || suffixSlice.startsWith(anchor.suffix);
    const proximityScore = anchor.approxPlainTextOffset === undefined
      ? 0
      : Math.max(0, 50 - Math.abs(foundAt - anchor.approxPlainTextOffset)) / 100;

    candidates.push({
      startOffset: foundAt,
      score: (prefixMatch ? 3 : 0) + (suffixMatch ? 3 : 0) + proximityScore,
    });
    searchIndex = foundAt + Math.max(1, exact.length);
  }

  if (candidates.length === 0) {
    return {
      status: "invalid",
      reason: `${fallbackReason}; exact text no longer exists`,
      anchor,
    };
  }

  candidates.sort((left, right) => right.score - left.score);
  const best = candidates[0];
  const second = candidates[1];

  if (second && Math.abs(best.score - second.score) < 0.25) {
    return {
      status: "ambiguous",
      reason: `${fallbackReason}; multiple plausible matches remained`,
      anchor,
    };
  }

  const from = offsetToPosition(index, best.startOffset);
  const to = offsetToPosition(index, best.startOffset + Math.max(exact.length - 1, 0), true);
  if (from === null || to === null || from >= to) {
    return {
      status: "invalid",
      reason: `${fallbackReason}; could not map repaired text back to document positions`,
      anchor,
    };
  }

  return {
    status: "repaired",
    reason: `${fallbackReason}; exact text plus context repaired the range`,
    anchor: buildAnchorFromRange(nextDoc, from, to, anchor.documentId, nextVersion),
  };
}

function buildPlainTextIndex(doc: ProseMirrorNode): {
  text: string;
  charStarts: number[];
  charEnds: number[];
} {
  const textParts: string[] = [];
  const charStarts: number[] = [];
  const charEnds: number[] = [];

  doc.forEach((blockNode, offset, index) => {
    const blockStartPos = offset + 1;
    if (index > 0) {
      const separatorPos = blockStartPos - 1;
      for (let i = 0; i < 2; i += 1) {
        textParts.push("\n");
        charStarts.push(separatorPos);
        charEnds.push(separatorPos);
      }
    }

    walkNodeText(blockNode, blockStartPos, textParts, charStarts, charEnds);
  });

  return {
    text: textParts.join(""),
    charStarts,
    charEnds,
  };
}

function walkNodeText(
  node: ProseMirrorNode,
  absolutePos: number,
  textParts: string[],
  charStarts: number[],
  charEnds: number[],
): void {
  if (node.isText) {
    const text = node.text ?? "";
    for (let index = 0; index < text.length; index += 1) {
      textParts.push(text[index] ?? "");
      charStarts.push(absolutePos + index);
      charEnds.push(absolutePos + index + 1);
    }
    return;
  }

  node.forEach((child, offset) => {
    walkNodeText(child, absolutePos + offset + 1, textParts, charStarts, charEnds);
  });
}

function offsetToPosition(
  index: ReturnType<typeof buildPlainTextIndex>,
  plainOffset: number,
  useEnd = false,
): number | null {
  if (plainOffset < 0) {
    return null;
  }

  if (plainOffset >= index.charStarts.length) {
    const finalEnd = index.charEnds[index.charEnds.length - 1];
    return finalEnd ?? null;
  }

  return useEnd ? index.charEnds[plainOffset] ?? null : index.charStarts[plainOffset] ?? null;
}

function buildAnchorFromRange(
  doc: ProseMirrorNode,
  from: number,
  to: number,
  documentId: string,
  versionSeen: number,
): TextAnchor {
  const index = buildPlainTextIndex(doc);
  const exact = doc.textBetween(from, to, "\n\n");
  const prefix = doc.textBetween(Math.max(1, from - 24), from, "\n\n");
  const suffix = doc.textBetween(to, Math.min(doc.content.size, to + 24), "\n\n");
  return {
    documentId,
    from,
    to,
    exact,
    prefix,
    suffix,
    blockPath: resolveBlockPath(doc, from),
    approxPlainTextOffset: index.text.indexOf(exact),
    versionSeen,
  };
}

function resolveBlockPath(doc: ProseMirrorNode, position: number): number[] {
  const resolved = doc.resolve(position);
  const indices: number[] = [];
  for (let depth = 0; depth <= resolved.depth; depth += 1) {
    indices.push(resolved.index(depth));
  }
  return indices;
}

function serializeNodePlainText(doc: ProseMirrorNode): string {
  return doc.textBetween(0, doc.content.size, "\n\n");
}

// ══════════════════════════════════════════════════════════════════════════
// BELOW → src/db/utils.ts
// Pure utilities — no DB, no domain knowledge. stableStringify is used by
// event payload hashing / equality checks; the rest are small helpers.
// ══════════════════════════════════════════════════════════════════════════
function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, nestedValue) => {
    if (nestedValue && typeof nestedValue === "object" && !Array.isArray(nestedValue)) {
      return Object.fromEntries(
        Object.entries(nestedValue as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)),
      );
    }
    return nestedValue;
  });
}

function boolToInt(value: boolean): number {
  return value ? 1 : 0;
}

function intToBool(value: number): boolean {
  return value === 1;
}

function isoNow(): string {
  return new Date().toISOString();
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function safeParseStringArray(serialized: string, fallback: string[]): string[] {
  try {
    const parsed = JSON.parse(serialized) as unknown;
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : fallback;
  } catch {
    return fallback;
  }
}
