import type {
  ApplyDocumentTransactionInput,
  ApplyDocumentTransactionResult,
  ClosePaneInput,
  ClipboardAuditResult,
  CreateDocumentInput,
  CreateEntityInput,
  CreateFolderInput,
  CreatePaneInput,
  CreateProjectInput,
  CreateSliceInput,
  DeleteDocumentInput,
  DeleteEntityInput,
  DeleteFolderInput,
  DeleteMatchingRuleInput,
  DeleteSliceInput,
  FocusPaneInput,
  MovePaneInput,
  PopOutPaneInput,
  SliceBoundaryRecord,
  PopPaneContentInput,
  PushPaneContentInput,
  ReplacePaneContentInput,
  UpdateSliceBoundaryInput,
  OpenDocumentInput,
  OpenProjectInput,
  ReorderDocumentInput,
  UpdateDocumentMetaInput,
  UpdateEntityInput,
  UpdateFolderInput,
  UpdateLayoutInput,
  UpdatePaneInput,
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
  deleteFolder: "workspace:delete-folder",
  createDocument: "workspace:create-document",
  updateDocumentMeta: "workspace:update-document-meta",
  deleteDocument: "workspace:delete-document",
  reorderDocument: "workspace:reorder-document",
  openDocument: "workspace:open-document",
  updateLayout: "workspace:update-layout",
  createPane: "workspace:create-pane",
  updatePane: "workspace:update-pane",
  closePane: "workspace:close-pane",
  focusPane: "workspace:focus-pane",
  replacePaneContent: "workspace:replace-pane-content",
  pushPaneContent: "workspace:push-pane-content",
  popPaneContent: "workspace:pop-pane-content",
  movePane: "workspace:move-pane",
  popOutPane: "workspace:pop-out-pane",
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
  deleteFolder(input: DeleteFolderInput): Promise<WorkspaceState>;
  createDocument(input: CreateDocumentInput): Promise<WorkspaceState>;
  updateDocumentMeta(input: UpdateDocumentMetaInput): Promise<WorkspaceState>;
  deleteDocument(input: DeleteDocumentInput): Promise<WorkspaceState>;
  reorderDocument(input: ReorderDocumentInput): Promise<WorkspaceState>;
  openDocument(input: OpenDocumentInput): Promise<WorkspaceState>;
  updateLayout(input: UpdateLayoutInput): Promise<WorkspaceState>;
  createPane(input: CreatePaneInput): Promise<WorkspaceState>;
  updatePane(input: UpdatePaneInput): Promise<WorkspaceState>;
  closePane(input: ClosePaneInput): Promise<WorkspaceState>;
  focusPane(input: FocusPaneInput): Promise<WorkspaceState>;
  replacePaneContent(input: ReplacePaneContentInput): Promise<WorkspaceState>;
  pushPaneContent(input: PushPaneContentInput): Promise<WorkspaceState>;
  popPaneContent(input: PopPaneContentInput): Promise<WorkspaceState>;
  movePane(input: MovePaneInput): Promise<WorkspaceState>;
  popOutPane(input: PopOutPaneInput): Promise<WorkspaceState>;
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
