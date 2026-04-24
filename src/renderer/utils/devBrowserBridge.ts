// Dev-only in-memory mock of `window.evernear`. Only installed by
// main.tsx when the preload bridge is absent — i.e. when the renderer
// is being previewed via `npm run dev:renderer` in a plain browser,
// outside the Electron shell. Seeds a small workspace so UI flows like
// the slice hover preview have something real to render.
//
// This is *not* wired into the Electron build. When contextBridge has
// exposed `window.evernear`, main.tsx leaves it alone.

import { schema as basicSchema } from "prosemirror-schema-basic";

import type { HarnessBridge } from "../../shared/contracts/harnessApi";
import type { JsonObject } from "../../shared/domain/document";
import type {
  ApplyDocumentTransactionInput,
  ApplyDocumentTransactionResult,
  SliceBoundaryRecord,
  WorkspaceState,
  WorkspaceStatus,
} from "../../shared/domain/workspace";
import { buildAnchorFromRange } from "../../shared/anchoring";

const PROJECT_ID = "dev-project";
const FOLDER_ID = "dev-folder";
const DOCUMENT_ID = "dev-doc";
const ENTITY_ID = "dev-entity-kaevlin";
const RULE_ID = "dev-rule-kaevlin";
const SLICE_ID = "dev-slice-kaevlin";
const BOUNDARY_ID = "dev-boundary-kaevlin";

const PARAGRAPH_1 =
  "Kaevlin walked toward the harbor as the lights came on one by one along the pier.";
const PARAGRAPH_2 =
  "She had been coming here since she was small, and tonight the smell of cold salt and kerosene reminded her that some things refused to change. The tide had already pulled the last fishing skiffs out of sight, and only the harbormaster's lamp still swung from its iron hook above the weighbridge.";
const PARAGRAPH_3 =
  "Kaevlin crouched beside a coil of rope, pressed two fingers to the planks, and waited. Something about the rhythm under the boards felt off — a half-beat slower than the water, and coming from the wrong direction.";

const now = () => new Date().toISOString();

function buildSeedWorkspace(): { workspace: WorkspaceState; status: WorkspaceStatus } {
  const contentJson: JsonObject = {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: PARAGRAPH_1 }] },
      { type: "paragraph", content: [{ type: "text", text: PARAGRAPH_2 }] },
      { type: "paragraph", content: [{ type: "text", text: PARAGRAPH_3 }] },
    ],
  };
  const plainText = `${PARAGRAPH_1}\n\n${PARAGRAPH_2}\n\n${PARAGRAPH_3}`;

  const doc = basicSchema.nodeFromJSON(contentJson);
  const anchor = buildAnchorFromRange(doc, 1, doc.content.size - 1, DOCUMENT_ID, 1);

  const timestamp = now();
  const boundary: SliceBoundaryRecord = {
    id: BOUNDARY_ID,
    sliceId: SLICE_ID,
    documentId: DOCUMENT_ID,
    anchor,
    resolution: {
      status: "resolved",
      reason: "seeded by dev browser bridge",
      anchor,
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const workspace: WorkspaceState = {
    projects: [{ id: PROJECT_ID, name: "Dev Preview Project", createdAt: timestamp, updatedAt: timestamp }],
    folders: [{
      id: FOLDER_ID,
      projectId: PROJECT_ID,
      parentFolderId: null,
      title: "Story",
      ordering: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    }],
    documents: [{
      id: DOCUMENT_ID,
      projectId: PROJECT_ID,
      folderId: FOLDER_ID,
      title: "The Harbor",
      ordering: 0,
      wordCount: plainText.trim().split(/\s+/).length,
      characterCount: plainText.length,
      paragraphCount: 3,
      createdAt: timestamp,
      updatedAt: timestamp,
    }],
    activeDocument: {
      id: DOCUMENT_ID,
      title: "The Harbor",
      contentFormat: "prosemirror-basic",
      contentSchemaVersion: 1,
      contentJson,
      plainText,
      currentVersion: 1,
      updatedAt: timestamp,
    },
    panelDocument: null,
    openDocuments: [{
      id: DOCUMENT_ID,
      title: "The Harbor",
      contentFormat: "prosemirror-basic",
      contentSchemaVersion: 1,
      contentJson,
      plainText,
      currentVersion: 1,
      updatedAt: timestamp,
    }],
    panes: [
      {
        id: "dev-pane-nav",
        projectId: PROJECT_ID,
        title: "Projects",
        content: { kind: "projectNav" },
        placement: { kind: "docked", region: "left", stackId: "left", order: 0 },
        history: [],
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: "dev-pane-document",
        projectId: PROJECT_ID,
        title: "The Harbor",
        content: { kind: "document", documentId: DOCUMENT_ID },
        placement: { kind: "workspace", rect: { x: 300, y: 96, width: 860, height: 760 }, zIndex: 1 },
        history: [],
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    focusedPaneId: "dev-pane-document",
    entities: [{ id: ENTITY_ID, projectId: PROJECT_ID, name: "Kaevlin", createdAt: timestamp, updatedAt: timestamp }],
    matchingRules: [{
      id: RULE_ID,
      entityId: ENTITY_ID,
      label: "Kaevlin",
      kind: "literal",
      pattern: "Kaevlin",
      wholeWord: true,
      allowPossessive: true,
      enabled: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    }],
    slices: [{
      id: SLICE_ID,
      projectId: PROJECT_ID,
      documentId: DOCUMENT_ID,
      boundaryId: BOUNDARY_ID,
      title: "Arrival at the harbor",
      excerpt: anchor.exact.slice(0, 180),
      createdAt: timestamp,
      updatedAt: timestamp,
    }],
    sliceBoundaries: [boundary],
    entitySlices: [{ entityId: ENTITY_ID, sliceId: SLICE_ID, ordering: 0 }],
    layout: {
      activeProjectId: PROJECT_ID,
      activeDocumentId: DOCUMENT_ID,
      panelDocumentId: null,
      focusedPaneId: "dev-pane-document",
      selectedEntityId: ENTITY_ID,
      expandedFolderIds: [FOLDER_ID],
      highlightsEnabled: true,
      panelOpen: false,
      panelMode: "entities",
      lastFocusedDocumentId: DOCUMENT_ID,
      recentTargetDocumentIds: [],
    },
  };

  const status: WorkspaceStatus = {
    dbPath: "(browser-mode — no DB)",
    contentFormat: "prosemirror-basic",
    contentSchemaVersion: 1,
    synchronousMode: "NORMAL",
    storageEngine: "in-memory (browser)",
  };

  return { workspace, status };
}

export function installDevBrowserBridge(): void {
  if (typeof window === "undefined") return;
  const existing = (window as unknown as { evernear?: HarnessBridge }).evernear;
  if (existing) return;

  const state = buildSeedWorkspace();
  let workspace = state.workspace;
  const status = state.status;

  // All mutation methods echo back the current workspace so the hook
  // layer doesn't see "undefined" and crash. They don't attempt to
  // truly simulate persistence — this is a view-only preview.
  const snapshot = (): WorkspaceState => workspace;

  const applyLayout = (patch: Parameters<HarnessBridge["updateLayout"]>[0]): WorkspaceState => {
    workspace = {
      ...workspace,
      focusedPaneId: patch.focusedPaneId ?? workspace.focusedPaneId,
      layout: { ...workspace.layout, ...patch },
    };
    return workspace;
  };

  const applyDocumentTransaction = (
    input: ApplyDocumentTransactionInput,
  ): ApplyDocumentTransactionResult => {
    const active = workspace.activeDocument;
    if (!active || active.id !== input.documentId) {
      return {
        snapshot: active ?? workspace.activeDocument!,
        summary: workspace.documents[0],
        sliceBoundaries: workspace.sliceBoundaries.filter((b) => b.documentId === input.documentId),
        historySummary: { currentVersion: 1, stepCount: 0, checkpointCount: 0, eventCount: 0 },
      };
    }
    const nextSnapshot = {
      ...active,
      title: input.title || active.title,
      contentJson: input.contentJson,
      plainText: input.plainText,
      currentVersion: active.currentVersion + 1,
      updatedAt: now(),
    };
    workspace = {
      ...workspace,
      activeDocument: nextSnapshot,
      openDocuments: workspace.openDocuments.map((document) =>
        document.id === nextSnapshot.id ? nextSnapshot : document),
    };
    const summary = {
      ...workspace.documents[0],
      title: nextSnapshot.title,
      wordCount: input.plainText.trim().split(/\s+/).filter(Boolean).length,
      characterCount: input.plainText.length,
      paragraphCount: input.plainText.split(/\n{2,}/).filter(Boolean).length,
      updatedAt: nextSnapshot.updatedAt,
    };
    workspace = { ...workspace, documents: [summary] };
    return {
      snapshot: nextSnapshot,
      summary,
      sliceBoundaries: workspace.sliceBoundaries.filter((b) => b.documentId === input.documentId),
      historySummary: {
        currentVersion: nextSnapshot.currentVersion,
        stepCount: input.steps.length,
        checkpointCount: 0,
        eventCount: input.steps.length,
      },
    };
  };

  const bridge: HarnessBridge = {
    async getStatus() { return status; },
    async loadWorkspace() { return snapshot(); },
    async createProject() { return snapshot(); },
    async updateProject() { return snapshot(); },
    async openProject() { return snapshot(); },
    async createFolder() { return snapshot(); },
    async updateFolder() { return snapshot(); },
    async deleteFolder() { return snapshot(); },
    async createDocument() { return snapshot(); },
    async updateDocumentMeta() { return snapshot(); },
    async deleteDocument() { return snapshot(); },
    async reorderDocument() { return snapshot(); },
    async openDocument() { return snapshot(); },
    async updateLayout(input) { return applyLayout(input); },
    async createPane(input) {
      const pane = {
        id: `dev-pane-${Date.now()}`,
        projectId: input.projectId ?? PROJECT_ID,
        title: input.title ?? input.content.kind,
        content: input.content,
        placement: input.placement ?? {
          kind: "workspace" as const,
          rect: { x: 360, y: 140, width: 520, height: 560 },
          zIndex: workspace.panes.length + 2,
        },
        history: [],
        createdAt: now(),
        updatedAt: now(),
      };
      workspace = {
        ...workspace,
        panes: [...workspace.panes, pane],
        focusedPaneId: pane.id,
        layout: { ...workspace.layout, focusedPaneId: pane.id },
      };
      return snapshot();
    },
    async updatePane(input) {
      workspace = {
        ...workspace,
        panes: workspace.panes.map((pane) =>
          pane.id === input.paneId
            ? {
                ...pane,
                title: input.title ?? pane.title,
                content: input.content ?? pane.content,
                placement: input.placement ?? pane.placement,
                history: input.history ?? pane.history,
                updatedAt: now(),
              }
            : pane),
      };
      return snapshot();
    },
    async closePane(input) {
      workspace = {
        ...workspace,
        panes: workspace.panes.filter((pane) => pane.id !== input.paneId),
        focusedPaneId: workspace.focusedPaneId === input.paneId ? null : workspace.focusedPaneId,
      };
      return snapshot();
    },
    async focusPane(input) {
      return applyLayout({ focusedPaneId: input.paneId });
    },
    async replacePaneContent(input) {
      return this.updatePane({ paneId: input.paneId, content: input.content, title: input.title });
    },
    async pushPaneContent(input) {
      const pane = workspace.panes.find((candidate) => candidate.id === input.paneId);
      if (!pane) return snapshot();
      return this.updatePane({
        paneId: input.paneId,
        content: input.content,
        title: input.title,
        history: [...pane.history, pane.content],
      });
    },
    async popPaneContent(input) {
      const pane = workspace.panes.find((candidate) => candidate.id === input.paneId);
      const content = pane?.history.at(-1);
      if (!pane || !content) return snapshot();
      return this.updatePane({
        paneId: input.paneId,
        content,
        history: pane.history.slice(0, -1),
      });
    },
    async movePane(input) {
      return this.updatePane({ paneId: input.paneId, placement: input.placement });
    },
    async popOutPane() { return snapshot(); },
    async applyDocumentTransaction(input) { return applyDocumentTransaction(input); },
    async createEntity() { return snapshot(); },
    async updateEntity() { return snapshot(); },
    async deleteEntity() { return snapshot(); },
    async upsertMatchingRule() { return snapshot(); },
    async deleteMatchingRule() { return snapshot(); },
    async createSlice() { return snapshot(); },
    async deleteSlice() { return snapshot(); },
    async updateSliceBoundary(input) {
      const existing = workspace.sliceBoundaries.find((b) => b.id === input.boundaryId);
      if (!existing) {
        throw new Error(`Unknown slice boundary: ${input.boundaryId}`);
      }
      return {
        ...existing,
        anchor: input.anchor,
        resolution: { status: "resolved", reason: "manually repositioned by author", anchor: input.anchor },
        updatedAt: new Date().toISOString(),
      };
    },
    async writeCheckpoint() { /* noop */ },
    async replayDocumentToVersion(documentId) {
      const active = workspace.activeDocument;
      return {
        snapshot: active && active.id === documentId ? active : workspace.activeDocument!,
        sliceBoundaries: workspace.sliceBoundaries.filter((b) => b.documentId === documentId),
      };
    },
    async readClipboardText() { return ""; },
    async readClipboardHtml() { return ""; },
    async clearClipboard() { /* noop */ },
  };

  (window as unknown as { evernear: HarnessBridge }).evernear = bridge;
  // eslint-disable-next-line no-console
  console.info("[evernear] dev browser bridge installed (no Electron preload detected).");
}
