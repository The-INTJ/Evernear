// Thin composition facade over the per-aggregate repositories. Public
// surface matches the IPC contract (HarnessBridge) — every method returns
// a fresh WorkspaceState so main/index.ts stays a one-liner forwarder.
//
// Responsibilities:
//   1. Own construction + wiring of the per-aggregate repositories.
//   2. Arrange the outer `runInTransaction` for each mutation, so
//      cross-aggregate writes (createProject, deleteDocument, deleteEntity,
//      applyDocumentTransaction) stay atomic.
//   3. Compose reads from every repository into WorkspaceState.
//
// Non-responsibilities:
//   - SQL. That lives inside the specific aggregate.
//   - Event payload schemas. Those live in src/db/events.ts.

import { randomUUID } from "node:crypto";

import { type JsonObject } from "../../shared/domain/document";
import {
  DEFAULT_FOLDER_ID,
  DEFAULT_PROJECT_ID,
  DEFAULT_PROJECT_NAME,
  DEFAULT_STORY_DOCUMENT_ID,
  DEFAULT_STORY_DOCUMENT_TITLE,
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
  type SliceBoundaryRecord,
  type UpdateSliceBoundaryInput,
  type HistorySummary,
  type MoveDocumentInput,
  type MoveFolderInput,
  type OpenDocumentInput,
  type OpenProjectInput,
  type ReorderDocumentInput,
  type UpdateDocumentMetaInput,
  type UpdateEntityInput,
  type UpdateFolderInput,
  type UpdateLayoutInput,
  type UpdateProjectInput,
  type UpsertMatchingRuleInput,
  type WorkspaceDocumentReplayResult,
  type WorkspaceState,
} from "../../shared/domain/workspace";
import type { SqliteHarness } from "../sqliteHarness";
import { uniqueStrings } from "../utils";
import { buildEmptyDocumentJson } from "../rowMappers";
import { DocumentRepository } from "./DocumentRepository";
import { EntityRepository } from "./EntityRepository";
import { FolderRepository } from "./FolderRepository";
import { HistoryRepository } from "./HistoryRepository";
import { LayoutRepository } from "./LayoutRepository";
import { ProjectRepository } from "./ProjectRepository";
import { SliceRepository } from "./SliceRepository";

export class WorkspaceRepository {
  private readonly history: HistoryRepository;
  private readonly layout: LayoutRepository;
  private readonly projects: ProjectRepository;
  private readonly folders: FolderRepository;
  private readonly documents: DocumentRepository;
  private readonly entities: EntityRepository;
  private readonly slices: SliceRepository;

  constructor(private readonly sqlite: SqliteHarness) {
    this.history = new HistoryRepository(sqlite);
    this.layout = new LayoutRepository(sqlite);
    this.projects = new ProjectRepository(sqlite, this.history);
    this.folders = new FolderRepository(sqlite, this.history);
    this.documents = new DocumentRepository(sqlite, this.history);
    this.entities = new EntityRepository(sqlite, this.history);
    this.slices = new SliceRepository(sqlite, this.history);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Bootstrap + compose
  // ═══════════════════════════════════════════════════════════════════════

  ensureWorkspaceState(): WorkspaceState {
    return this.sqlite.runInTransaction(() => {
      this.ensureSeedState();
      return this.loadWorkspace();
    });
  }

  loadWorkspace(): WorkspaceState {
    this.ensureSeedState();

    const projects = this.projects.loadProjects();
    const activeProjectId = this.layout.requireActiveProjectId();
    const folders = this.folders.loadFolders(activeProjectId);
    const documents = this.documents.loadDocumentSummaries(activeProjectId);
    const entities = this.entities.loadEntities(activeProjectId);
    const matchingRules = this.entities.loadMatchingRulesForProject(activeProjectId);
    const slices = this.slices.loadSlices(activeProjectId);
    const sliceBoundaries = this.slices.loadSliceBoundariesForProject(activeProjectId);
    const entitySlices = this.slices.loadEntitySlices(activeProjectId);
    const layout = this.layout.loadLayoutState(
      activeProjectId,
      documents,
      entities,
      (projectId) => this.folders.loadFolderIds(projectId),
    );

    const activeDocument = layout.activeDocumentId
      ? this.documents.loadDocumentSnapshot(layout.activeDocumentId)
      : null;
    const panelDocument = layout.panelDocumentId
      ? this.documents.loadDocumentSnapshot(layout.panelDocumentId)
      : null;

    // Stale pointers: a previous run may have referenced a document that
    // has since been deleted. Repair quietly and re-load.
    if (layout.activeDocumentId && !activeDocument) {
      this.layout.saveLayoutState(activeProjectId, {
        ...layout,
        activeDocumentId: documents[0]?.id ?? null,
      });
      return this.loadWorkspace();
    }

    if (layout.panelDocumentId && !panelDocument) {
      this.layout.saveLayoutState(activeProjectId, {
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

  // ═══════════════════════════════════════════════════════════════════════
  // Project
  // ═══════════════════════════════════════════════════════════════════════

  createProject(input: CreateProjectInput): WorkspaceState {
    return this.sqlite.runInTransaction(() => {
      const projectId = randomUUID();
      const folderId = randomUUID();
      const documentId = randomUUID();

      this.projects.createProject(input, projectId);
      this.folders.createFolder(
        { projectId, title: "Story", parentFolderId: null },
        folderId,
      );
      this.documents.createDocument(
        {
          projectId,
          folderId,
          title: DEFAULT_STORY_DOCUMENT_TITLE,
        },
        documentId,
      );

      this.layout.setActiveProjectId(projectId);
      this.layout.saveLayoutState(projectId, {
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
      return this.loadWorkspace();
    });
  }

  updateProject(input: UpdateProjectInput): WorkspaceState {
    return this.sqlite.runInTransaction(() => {
      this.projects.updateProject(input);
      return this.loadWorkspace();
    });
  }

  openProject(input: OpenProjectInput): WorkspaceState {
    return this.sqlite.runInTransaction(() => {
      this.layout.setActiveProjectId(input.projectId);
      // Read-through to touch the layout row for the newly-active project,
      // materializing a default if one doesn't exist yet.
      const documents = this.documents.loadDocumentSummaries(input.projectId);
      const entities = this.entities.loadEntities(input.projectId);
      this.layout.loadLayoutState(
        input.projectId,
        documents,
        entities,
        (projectId) => this.folders.loadFolderIds(projectId),
      );
      return this.loadWorkspace();
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Folder
  // ═══════════════════════════════════════════════════════════════════════

  createFolder(input: CreateFolderInput): WorkspaceState {
    return this.sqlite.runInTransaction(() => {
      const folderId = randomUUID();
      this.folders.createFolder(input, folderId);
      const layout = this.loadLayoutWithDeps(input.projectId);
      this.layout.saveLayoutState(input.projectId, {
        ...layout,
        expandedFolderIds: uniqueStrings([...layout.expandedFolderIds, folderId]),
      });
      return this.loadWorkspace();
    });
  }

  updateFolder(input: UpdateFolderInput): WorkspaceState {
    return this.sqlite.runInTransaction(() => {
      this.folders.updateFolder(input);
      return this.loadWorkspace();
    });
  }

  moveFolder(input: MoveFolderInput): WorkspaceState {
    return this.sqlite.runInTransaction(() => {
      this.folders.moveFolder(input);
      return this.loadWorkspace();
    });
  }

  deleteFolder(input: DeleteFolderInput): WorkspaceState {
    return this.sqlite.runInTransaction(() => {
      const result = this.folders.deleteFolder(input);
      if (result.row) {
        const layout = this.loadLayoutWithDeps(result.row.project_id);
        this.layout.saveLayoutState(result.row.project_id, {
          ...layout,
          expandedFolderIds: layout.expandedFolderIds.filter((id) => id !== input.folderId),
        });
      }
      return this.loadWorkspace();
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Document
  // ═══════════════════════════════════════════════════════════════════════

  createDocument(input: CreateDocumentInput): WorkspaceState {
    return this.sqlite.runInTransaction(() => {
      const documentId = randomUUID();
      this.documents.createDocument(input, documentId);

      const layout = this.loadLayoutWithDeps(input.projectId);
      this.layout.saveLayoutState(input.projectId, {
        ...layout,
        activeDocumentId: input.openInPanel ? layout.activeDocumentId : documentId,
        panelDocumentId: input.openInPanel ? documentId : layout.panelDocumentId,
        panelOpen: input.openInPanel ? true : layout.panelOpen,
        lastFocusedDocumentId: input.openInPanel ? layout.lastFocusedDocumentId : documentId,
        recentTargetDocumentIds: uniqueStrings([documentId, ...layout.recentTargetDocumentIds]).slice(0, 5),
      });
      return this.loadWorkspace();
    });
  }

  updateDocumentMeta(input: UpdateDocumentMetaInput): WorkspaceState {
    return this.sqlite.runInTransaction(() => {
      this.documents.updateDocumentMeta(input);
      return this.loadWorkspace();
    });
  }

  deleteDocument(input: DeleteDocumentInput): WorkspaceState {
    return this.sqlite.runInTransaction(() => {
      const result = this.documents.deleteDocument(input);
      for (const sliceId of result.sliceIds) {
        this.slices.deleteSlice(sliceId);
      }
      const layout = this.loadLayoutWithDeps(result.projectId);
      const fallbackDocumentId = this.documents.loadDocumentSummaries(result.projectId)[0]?.id ?? null;
      this.layout.saveLayoutState(result.projectId, {
        ...layout,
        activeDocumentId: layout.activeDocumentId === input.documentId ? fallbackDocumentId : layout.activeDocumentId,
        panelDocumentId: layout.panelDocumentId === input.documentId ? null : layout.panelDocumentId,
        lastFocusedDocumentId: layout.lastFocusedDocumentId === input.documentId ? fallbackDocumentId : layout.lastFocusedDocumentId,
        recentTargetDocumentIds: layout.recentTargetDocumentIds.filter((id) => id !== input.documentId),
      });
      return this.loadWorkspace();
    });
  }

  reorderDocument(input: ReorderDocumentInput): WorkspaceState {
    return this.sqlite.runInTransaction(() => {
      this.documents.reorderDocument(input);
      return this.loadWorkspace();
    });
  }

  moveDocument(input: MoveDocumentInput): WorkspaceState {
    return this.sqlite.runInTransaction(() => {
      this.documents.moveDocument(input);
      return this.loadWorkspace();
    });
  }

  openDocument(input: OpenDocumentInput): WorkspaceState {
    return this.sqlite.runInTransaction(() => {
      const row = this.documents.requireDocumentRow(input.documentId);
      const projectId = row.project_id ?? DEFAULT_PROJECT_ID;
      this.layout.setActiveProjectId(projectId);
      const layout = this.loadLayoutWithDeps(projectId);
      this.layout.saveLayoutState(projectId, {
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

  updateLayout(input: UpdateLayoutInput): WorkspaceState {
    return this.sqlite.runInTransaction(() => {
      const activeProjectId = input.activeProjectId ?? this.layout.requireActiveProjectId();
      const layout = this.loadLayoutWithDeps(activeProjectId);
      this.layout.saveLayoutState(activeProjectId, {
        ...layout,
        ...input,
        activeProjectId,
      });
      if (input.activeProjectId) {
        this.layout.setActiveProjectId(input.activeProjectId);
      }
      return this.loadWorkspace();
    });
  }

  applyDocumentTransaction(input: ApplyDocumentTransactionInput): ApplyDocumentTransactionResult {
    return this.sqlite.runInTransaction(() => {
      const core = this.documents.applyDocumentTransaction(input);
      const sliceBoundaries = this.slices.rewriteBoundariesAfterSteps(core.snapshot, input.steps);
      return {
        snapshot: core.snapshot,
        summary: core.summary,
        sliceBoundaries,
        historySummary: this.history.loadHistorySummary(input.documentId, core.nextVersion),
      };
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Entity + matching rule
  // ═══════════════════════════════════════════════════════════════════════

  createEntity(input: CreateEntityInput): WorkspaceState {
    return this.sqlite.runInTransaction(() => {
      const entityId = randomUUID();
      this.entities.createEntity(input, entityId);
      const layout = this.loadLayoutWithDeps(input.projectId);
      this.layout.saveLayoutState(input.projectId, {
        ...layout,
        selectedEntityId: entityId,
        panelOpen: true,
        panelMode: "entities",
      });
      return this.loadWorkspace();
    });
  }

  updateEntity(input: UpdateEntityInput): WorkspaceState {
    return this.sqlite.runInTransaction(() => {
      this.entities.updateEntity(input);
      return this.loadWorkspace();
    });
  }

  deleteEntity(input: DeleteEntityInput): WorkspaceState {
    return this.sqlite.runInTransaction(() => {
      const result = this.entities.deleteEntity(input);
      if (!result) {
        return this.loadWorkspace();
      }

      for (const sliceId of result.orphanedSliceIds) {
        if (!this.slices.slicesStillReferenced(sliceId)) {
          this.slices.deleteSlice(sliceId);
        }
      }

      const layout = this.loadLayoutWithDeps(result.projectId);
      const entities = this.entities.loadEntities(result.projectId);
      this.layout.saveLayoutState(result.projectId, {
        ...layout,
        selectedEntityId: layout.selectedEntityId === input.entityId
          ? entities[0]?.id ?? null
          : layout.selectedEntityId,
      });
      return this.loadWorkspace();
    });
  }

  upsertMatchingRule(input: UpsertMatchingRuleInput): WorkspaceState {
    return this.sqlite.runInTransaction(() => {
      const ruleId = input.id ?? randomUUID();
      this.entities.upsertMatchingRule(input, ruleId);
      return this.loadWorkspace();
    });
  }

  deleteMatchingRule(input: DeleteMatchingRuleInput): WorkspaceState {
    return this.sqlite.runInTransaction(() => {
      this.entities.deleteMatchingRule(input);
      return this.loadWorkspace();
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Slice
  // ═══════════════════════════════════════════════════════════════════════

  createSlice(input: CreateSliceInput): WorkspaceState {
    return this.sqlite.runInTransaction(() => {
      const sliceId = randomUUID();
      const boundaryId = randomUUID();
      this.slices.createSlice(input, sliceId, boundaryId);

      const layout = this.loadLayoutWithDeps(input.projectId);
      this.layout.saveLayoutState(input.projectId, {
        ...layout,
        selectedEntityId: input.entityId,
        panelOpen: true,
        panelMode: "document",
        panelDocumentId: input.documentId,
        recentTargetDocumentIds: uniqueStrings([input.documentId, ...layout.recentTargetDocumentIds]).slice(0, 5),
      });
      return this.loadWorkspace();
    });
  }

  deleteSlice(input: DeleteSliceInput): WorkspaceState {
    return this.sqlite.runInTransaction(() => {
      this.slices.deleteSlice(input.sliceId);
      return this.loadWorkspace();
    });
  }

  updateSliceBoundary(input: UpdateSliceBoundaryInput): SliceBoundaryRecord {
    return this.sqlite.runInTransaction(() => this.slices.updateSliceBoundary(input.boundaryId, input.anchor));
  }

  // ═══════════════════════════════════════════════════════════════════════
  // History
  // ═══════════════════════════════════════════════════════════════════════

  writeCheckpoint(documentId: string, label: string | null): void {
    this.sqlite.runInTransaction(() => {
      const snapshot = this.documents.requireDocumentSnapshot(documentId);
      this.history.ensureCheckpoint(snapshot, label);
    });
  }

  replayDocumentToVersion(documentId: string, targetVersion: number): WorkspaceDocumentReplayResult {
    const snapshot = this.history.replayDocumentToVersion(documentId, targetVersion);
    const sliceBoundaries = this.slices.loadSliceBoundariesForDocument(documentId).map((boundary) => ({
      ...boundary,
      resolution: {
        ...boundary.resolution,
        anchor: { ...boundary.resolution.anchor, versionSeen: targetVersion },
      },
    }));
    return { snapshot, sliceBoundaries };
  }

  loadHistorySummary(documentId: string): HistorySummary {
    const snapshot = this.documents.requireDocumentSnapshot(documentId);
    return this.history.loadHistorySummary(documentId, snapshot.currentVersion);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Private seed + layout helpers
  // ═══════════════════════════════════════════════════════════════════════

  // Bootstrap precondition. A pure replay from the event log + checkpoints
  // will NOT recreate the default project / Story folder / initial document
  // — those rows are materialized here as a first-run side effect, without
  // appending to the event log. This is intentional: synthetic seed events
  // on every fresh database would muddy the log with non-author actions
  // and wouldn't carry meaningful payloads.
  //
  // If a future feature needs the initial state to be fully derivable from
  // logs + checkpoints (e.g. cross-device replay, tamper detection), append
  // synthetic *Materialized events here instead. See src/db/README.md
  // ("Bootstrap precondition vs. event-derived state") for the policy.
  //
  // The one operation here that CAN run on a non-empty database is
  // `adoptOrphanedMatchingRules` — it materializes entities from pre-Phase-1
  // matching rules and so MUST append events. That happens inside the
  // EntityRepository call below.
  private ensureSeedState(): void {
    if (this.projects.countProjects() === 0) {
      this.projects.insertSeedProject(DEFAULT_PROJECT_ID, DEFAULT_PROJECT_NAME);
    }

    const activeProjectId = this.layout.loadActiveProjectId() ?? DEFAULT_PROJECT_ID;
    this.layout.setActiveProjectId(activeProjectId);

    const documents = this.documents.loadDocumentSummaries(activeProjectId);
    if (documents.length === 0) {
      let folders = this.folders.loadFolders(activeProjectId);
      if (folders.length === 0) {
        this.folders.insertFolder({
          id: DEFAULT_FOLDER_ID,
          projectId: activeProjectId,
          parentFolderId: null,
          title: "Story",
          ordering: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        folders = this.folders.loadFolders(activeProjectId);
      }

      this.documents.insertDocument({
        id: DEFAULT_STORY_DOCUMENT_ID,
        projectId: activeProjectId,
        folderId: folders[0]?.id ?? DEFAULT_FOLDER_ID,
        ordering: 0,
        title: DEFAULT_STORY_DOCUMENT_TITLE,
        contentJson: buildEmptyDocumentJson() as JsonObject,
        plainText: "",
      });
      this.history.ensureCheckpoint(
        this.documents.requireDocumentSnapshot(DEFAULT_STORY_DOCUMENT_ID),
        "initial-head",
      );
    }

    this.entities.adoptOrphanedMatchingRules(activeProjectId, () => randomUUID());

    // Materialize a default layout row once documents + entities exist.
    this.layout.loadLayoutState(
      activeProjectId,
      this.documents.loadDocumentSummaries(activeProjectId),
      this.entities.loadEntities(activeProjectId),
      (projectId) => this.folders.loadFolderIds(projectId),
    );
  }

  private loadLayoutWithDeps(projectId: string) {
    const documents = this.documents.loadDocumentSummaries(projectId);
    const entities = this.entities.loadEntities(projectId);
    return this.layout.loadLayoutState(
      projectId,
      documents,
      entities,
      (id) => this.folders.loadFolderIds(id),
    );
  }
}
