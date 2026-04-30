import type {
  ApplyDocumentTransactionInput,
  ApplyDocumentTransactionResult,
  ClipboardAuditResult,
  CreateDocumentInput,
  CreateEntityInput,
  CreateFolderInput,
  CreateProjectInput,
  CreateSliceInput,
  DeleteDocumentInput,
  DeleteEntityInput,
  DeleteFolderInput,
  DeleteMatchingRuleInput,
  DeleteSliceInput,
  MoveDocumentInput,
  MoveFolderInput,
  SliceBoundaryRecord,
  UpdateSliceBoundaryInput,
  OpenDocumentInput,
  OpenProjectInput,
  ReorderDocumentInput,
  UpdateDocumentMetaInput,
  UpdateEntityInput,
  UpdateFolderInput,
  UpdateLayoutInput,
  UpdateProjectInput,
  UpsertMatchingRuleInput,
  WorkspaceDocumentReplayResult,
  WorkspaceState,
  WorkspaceStatus,
} from "../domain/workspace";

export const HARNESS_CHANNELS = {
  getStatus: "workspace:get-status",
  loadWorkspace: "workspace:load-workspace",
  createProject: "workspace:create-project",
  updateProject: "workspace:update-project",
  openProject: "workspace:open-project",
  createFolder: "workspace:create-folder",
  updateFolder: "workspace:update-folder",
  moveFolder: "workspace:move-folder",
  deleteFolder: "workspace:delete-folder",
  createDocument: "workspace:create-document",
  updateDocumentMeta: "workspace:update-document-meta",
  deleteDocument: "workspace:delete-document",
  reorderDocument: "workspace:reorder-document",
  moveDocument: "workspace:move-document",
  openDocument: "workspace:open-document",
  updateLayout: "workspace:update-layout",
  applyDocumentTransaction: "workspace:apply-document-transaction",
  createEntity: "workspace:create-entity",
  updateEntity: "workspace:update-entity",
  deleteEntity: "workspace:delete-entity",
  upsertMatchingRule: "workspace:upsert-matching-rule",
  deleteMatchingRule: "workspace:delete-matching-rule",
  createSlice: "workspace:create-slice",
  deleteSlice: "workspace:delete-slice",
  updateSliceBoundary: "workspace:update-slice-boundary",
  writeCheckpoint: "workspace:write-checkpoint",
  replayDocumentToVersion: "workspace:replay-document-to-version",
  readClipboardText: "workspace:read-clipboard-text",
  readClipboardHtml: "workspace:read-clipboard-html",
  clearClipboard: "workspace:clear-clipboard",
} as const;

export interface HarnessBridge {
  getStatus(): Promise<WorkspaceStatus>;
  loadWorkspace(): Promise<WorkspaceState>;
  createProject(input: CreateProjectInput): Promise<WorkspaceState>;
  updateProject(input: UpdateProjectInput): Promise<WorkspaceState>;
  openProject(input: OpenProjectInput): Promise<WorkspaceState>;
  createFolder(input: CreateFolderInput): Promise<WorkspaceState>;
  updateFolder(input: UpdateFolderInput): Promise<WorkspaceState>;
  moveFolder(input: MoveFolderInput): Promise<WorkspaceState>;
  deleteFolder(input: DeleteFolderInput): Promise<WorkspaceState>;
  createDocument(input: CreateDocumentInput): Promise<WorkspaceState>;
  updateDocumentMeta(input: UpdateDocumentMetaInput): Promise<WorkspaceState>;
  deleteDocument(input: DeleteDocumentInput): Promise<WorkspaceState>;
  reorderDocument(input: ReorderDocumentInput): Promise<WorkspaceState>;
  moveDocument(input: MoveDocumentInput): Promise<WorkspaceState>;
  openDocument(input: OpenDocumentInput): Promise<WorkspaceState>;
  updateLayout(input: UpdateLayoutInput): Promise<WorkspaceState>;
  applyDocumentTransaction(input: ApplyDocumentTransactionInput): Promise<ApplyDocumentTransactionResult>;
  createEntity(input: CreateEntityInput): Promise<WorkspaceState>;
  updateEntity(input: UpdateEntityInput): Promise<WorkspaceState>;
  deleteEntity(input: DeleteEntityInput): Promise<WorkspaceState>;
  upsertMatchingRule(input: UpsertMatchingRuleInput): Promise<WorkspaceState>;
  deleteMatchingRule(input: DeleteMatchingRuleInput): Promise<WorkspaceState>;
  createSlice(input: CreateSliceInput): Promise<WorkspaceState>;
  deleteSlice(input: DeleteSliceInput): Promise<WorkspaceState>;
  updateSliceBoundary(input: UpdateSliceBoundaryInput): Promise<SliceBoundaryRecord>;
  writeCheckpoint(documentId: string, label: string | null): Promise<void>;
  replayDocumentToVersion(documentId: string, targetVersion: number): Promise<WorkspaceDocumentReplayResult>;
  readClipboardText(): Promise<string>;
  readClipboardHtml(): Promise<string>;
  clearClipboard(): Promise<void>;
}

export type ClipboardAuditBridge = {
  readClipboardText(): Promise<string>;
  readClipboardHtml(): Promise<string>;
  clearClipboard(): Promise<void>;
};

export type WorkspaceDebugSnapshot = ClipboardAuditResult;
