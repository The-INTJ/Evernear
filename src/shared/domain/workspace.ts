import type { JsonObject, StoredDocumentSnapshot } from "./document";

export const DEFAULT_PROJECT_ID = "default-project";
export const DEFAULT_FOLDER_ID = "story-folder";
export const DEFAULT_PROJECT_NAME = "Untitled Project";
export const DEFAULT_STORY_DOCUMENT_ID = "story-document";
export const DEFAULT_STORY_DOCUMENT_TITLE = "Story Draft";

export type MatchingRuleKind = "literal" | "alias" | "regex";
export type AnchorResolutionStatus = "resolved" | "repaired" | "ambiguous" | "invalid";
export type PanelMode = "entities" | "chooser" | "placement" | "document";

export type TextAnchor = {
  documentId: string;
  from: number;
  to: number;
  exact: string;
  prefix: string;
  suffix: string;
  blockPath: number[];
  approxPlainTextOffset?: number;
  versionSeen: number;
};

export type AnchorResolutionResult = {
  status: AnchorResolutionStatus;
  reason: string;
  anchor: TextAnchor;
};

export type WorkspaceStatus = {
  dbPath: string;
  contentFormat: string;
  contentSchemaVersion: number;
  synchronousMode: "FULL" | "NORMAL";
  storageEngine: string;
};

export type ProjectRecord = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type DocumentFolderRecord = {
  id: string;
  projectId: string;
  parentFolderId: string | null;
  title: string;
  ordering: number;
  createdAt: string;
  updatedAt: string;
};

export type DocumentSummary = {
  id: string;
  projectId: string;
  folderId: string | null;
  title: string;
  ordering: number;
  wordCount: number;
  characterCount: number;
  paragraphCount: number;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceLayoutState = {
  activeProjectId: string | null;
  activeDocumentId: string | null;
  panelDocumentId: string | null;
  selectedEntityId: string | null;
  expandedFolderIds: string[];
  highlightsEnabled: boolean;
  panelOpen: boolean;
  panelMode: PanelMode;
  lastFocusedDocumentId: string | null;
  recentTargetDocumentIds: string[];
};

export type EntityRecord = {
  id: string;
  projectId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type MatchingRuleRecord = {
  id: string;
  entityId: string;
  label: string;
  kind: MatchingRuleKind;
  pattern: string;
  wholeWord: boolean;
  allowPossessive: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SliceBoundaryRecord = {
  id: string;
  sliceId: string;
  documentId: string;
  anchor: TextAnchor;
  resolution: AnchorResolutionResult;
  createdAt: string;
  updatedAt: string;
};

export type SliceRecord = {
  id: string;
  projectId: string;
  documentId: string;
  boundaryId: string;
  title: string;
  excerpt: string;
  createdAt: string;
  updatedAt: string;
};

export type EntitySliceRecord = {
  entityId: string;
  sliceId: string;
  ordering: number;
};

export type EntityMatchHit = {
  entityId: string;
  entityName: string;
  ruleId: string;
  label: string;
  from: number;
  to: number;
  matchedText: string;
  normalizedText: string;
};

export type WorkspaceState = {
  projects: ProjectRecord[];
  folders: DocumentFolderRecord[];
  documents: DocumentSummary[];
  activeDocument: StoredDocumentSnapshot | null;
  panelDocument: StoredDocumentSnapshot | null;
  entities: EntityRecord[];
  matchingRules: MatchingRuleRecord[];
  slices: SliceRecord[];
  sliceBoundaries: SliceBoundaryRecord[];
  entitySlices: EntitySliceRecord[];
  layout: WorkspaceLayoutState;
};

export type BenchmarkCategory = "matching" | "history" | "layout" | "anchor" | "clipboard";

export type BenchmarkRecord = {
  id: string;
  category: BenchmarkCategory;
  payload: JsonObject;
  createdAt: string;
};

export type MatchingBenchmark = {
  visibleFrom: number;
  visibleTo: number;
  visibleCharacterCount: number;
  matchCount: number;
  recomputeMs: number;
  ruleCount: number;
  highlightingEnabled: boolean;
  createdAt: string;
};

export type ClipboardAuditResult = {
  copiedText: string;
  copiedHtml: string;
  copiedTextMatchesPersistedPlainText: boolean;
  richHtmlPresent: boolean;
  leakedWorkbenchMarkup: boolean;
  leakedMarkers: string[];
};

export type HistorySummary = {
  currentVersion: number;
  stepCount: number;
  checkpointCount: number;
  eventCount: number;
};

export type ApplyDocumentTransactionInput = {
  documentId: string;
  baseVersion: number;
  title: string;
  steps: JsonObject[];
  inverseSteps: JsonObject[];
  contentJson: JsonObject;
  plainText: string;
  saveIntent?: boolean;
};

export type ApplyDocumentTransactionResult = {
  snapshot: StoredDocumentSnapshot;
  summary: DocumentSummary;
  sliceBoundaries: SliceBoundaryRecord[];
  historySummary: HistorySummary;
};

export type CreateProjectInput = {
  name: string;
};

export type UpdateProjectInput = {
  projectId: string;
  name: string;
};

export type OpenProjectInput = {
  projectId: string;
};

export type CreateFolderInput = {
  projectId: string;
  title: string;
  parentFolderId?: string | null;
};

export type UpdateFolderInput = {
  folderId: string;
  title: string;
};

export type DeleteFolderInput = {
  folderId: string;
};

export type CreateDocumentInput = {
  projectId: string;
  folderId: string | null;
  title: string;
  openInPanel?: boolean;
};

export type UpdateDocumentMetaInput = {
  documentId: string;
  title?: string;
  folderId?: string | null;
};

export type DeleteDocumentInput = {
  documentId: string;
};

export type ReorderDocumentInput = {
  documentId: string;
  direction: "up" | "down";
};

export type OpenDocumentInput = {
  documentId: string;
  surface: "main" | "panel";
};

export type UpdateLayoutInput = Partial<WorkspaceLayoutState>;

export type CreateEntityInput = {
  projectId: string;
  name: string;
};

export type UpdateEntityInput = {
  entityId: string;
  name: string;
};

export type DeleteEntityInput = {
  entityId: string;
};

export type UpsertMatchingRuleInput = {
  id?: string;
  entityId: string;
  label: string;
  kind: MatchingRuleKind;
  pattern: string;
  wholeWord: boolean;
  allowPossessive: boolean;
  enabled: boolean;
};

export type DeleteMatchingRuleInput = {
  ruleId: string;
};

export type CreateSliceInput = {
  projectId: string;
  entityId: string;
  documentId: string;
  title: string;
  anchor: TextAnchor;
};

export type DeleteSliceInput = {
  sliceId: string;
};

export type UpdateSliceBoundaryInput = {
  boundaryId: string;
  anchor: TextAnchor;
};

export type WorkspaceDocumentReplayResult = {
  snapshot: StoredDocumentSnapshot;
  sliceBoundaries: SliceBoundaryRecord[];
};
