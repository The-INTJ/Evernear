// App shell — composes hooks and feature components. Behavior lives in
// the hooks under src/renderer/state/ and the feature components under
// src/renderer/features/. This file owns top-level layout, draft text
// state (project name, document title, rule form), and editor refs.
//
// If this file grows past ~350 lines, the next thing to extract is likely
// the side-panel composition into features/panes/SidePanel.tsx.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createEmptyHarnessSnapshot } from "../shared/domain/harnessFixture";
import type {
  HarnessEditorHandle,
  HarnessEditorSnapshot,
} from "./editor/HarnessEditor";
import type { SerializedTransactionBundle } from "./editor/editorUtils";
import type { StoredDocumentSnapshot } from "../shared/domain/document";
import type { WorkspacePane } from "../shared/domain/workspace";

import { useEditorSelections } from "./state/useEditorSelections";
import { useEditorCommandActions } from "./state/useEditorCommandActions";
import { useEverlinkPlacement } from "./state/useEverlinkPlacement";
import { useEverslicePlacement } from "./state/useEverslicePlacement";
import { useWorkspace } from "./state/useWorkspace";
import { useWorkspaceActions } from "./state/useWorkspaceActions";
import { useWorkspaceLookups } from "./state/useWorkspaceLookups";
import {
  initialRuleForm,
  type HoverPreview as HoverPreviewState,
  type RuleFormState,
} from "./state/sessionTypes";
import {
  getActiveProject,
  getSelectedEntity,
  groupDocumentsByFolder,
  selectedSlicesForEntity,
} from "./utils/workspace";

import { TitleBar } from "./features/chrome/TitleBar";
import { NavPanel } from "./features/documents/NavPanel";
import { EditorActionOverlays } from "./features/documents/EditorActionOverlays";
import { EditorPane } from "./features/documents/EditorPane";
import { EversliceChooser } from "./features/entities/EversliceChooser";
import { EntityDetail } from "./features/entities/EntityDetail";
import { MatchingRuleEditor } from "./features/entities/MatchingRuleEditor";
import { HoverPreview } from "./features/panes/HoverPreview";
import { PaneWorkspace } from "./features/panes/PaneWorkspace";
import { EntitySlicesPane } from "./features/panes/EntitySlicesPane";
import { HowToUsePage } from "./features/help/HowToUsePage";
import type { ResolvedSliceView } from "./utils/workspace";

const HOVER_PREVIEW_HANDOFF_DELAY_MS = 800;
const HOVER_PREVIEW_EXIT_DELAY_MS = 180;

export function App() {
  const mainEditorRef = useRef<HarnessEditorHandle | null>(null);
  const panelEditorRef = useRef<HarnessEditorHandle | null>(null);
  const paneEditorRefs = useRef(new Map<string, HarnessEditorHandle>());

  const workspaceHook = useWorkspace();
  const { status, workspace, pendingWrites } = workspaceHook;
  const nativePaneId = useMemo(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("paneId");
  }, []);

  const selections = useEditorSelections();
  const lookups = useWorkspaceLookups(workspace);

  const everlink = useEverlinkPlacement({
    workspaceHook,
    selections,
    lookups,
    editorRefs: { main: mainEditorRef, panel: panelEditorRef },
  });

  const everslice = useEverslicePlacement({
    workspaceHook,
    selections,
    editorRef: mainEditorRef,
  });

  const activeProject = getActiveProject(workspace);
  const openDocumentsById = useMemo(() => {
    const map = new Map<string, StoredDocumentSnapshot>();
    for (const document of workspace?.openDocuments ?? []) {
      map.set(document.id, document);
    }
    if (workspace?.activeDocument) {
      map.set(workspace.activeDocument.id, workspace.activeDocument);
    }
    if (workspace?.panelDocument) {
      map.set(workspace.panelDocument.id, workspace.panelDocument);
    }
    return map;
  }, [workspace?.activeDocument, workspace?.openDocuments, workspace?.panelDocument]);
  const focusedPaneId = workspace?.focusedPaneId ?? workspace?.layout.focusedPaneId ?? null;
  const focusedPane = workspace?.panes.find((pane) => pane.id === focusedPaneId) ?? null;
  const focusedDocument = focusedPane?.content.kind === "document"
    ? openDocumentsById.get(focusedPane.content.documentId) ?? null
    : null;
  const renderedPanes = useMemo(() => {
    const panes = workspace?.panes ?? [];
    if (!nativePaneId) return panes;
    return panes
      .filter((pane) => pane.id === nativePaneId)
      .map((pane) => ({
        ...pane,
        placement: {
          kind: "workspace" as const,
          rect: { x: 16, y: 16, width: 900, height: 660 },
          zIndex: 1,
        },
      }));
  }, [nativePaneId, workspace?.panes]);
  const activeDocument = focusedDocument ?? workspace?.activeDocument ?? null;
  const selectedEntity = getSelectedEntity(workspace);

  // Draft text state — short-lived typing state that doesn't belong in
  // the persisted workspace. Kept at shell level because multiple feature
  // components read and write these.
  const [projectNameDraft, setProjectNameDraft] = useState("");
  const [documentTitleDraft, setDocumentTitleDraft] = useState("");
  const [documentTitleDrafts, setDocumentTitleDrafts] = useState<Record<string, string>>({});
  const [newFolderTitle, setNewFolderTitle] = useState("");
  const [newDocumentTitle, setNewDocumentTitle] = useState("");
  const [entityNameDraft, setEntityNameDraft] = useState("");
  const [ruleForm, setRuleForm] = useState<RuleFormState>(initialRuleForm);
  const [hoverPreview, setHoverPreview] = useState<HoverPreviewState | null>(null);
  const [editorFullScreen, setEditorFullScreen] = useState(false);
  const [activeScreen, setActiveScreen] = useState<"workspace" | "shortcuts">("workspace");

  useEffect(() => {
    setProjectNameDraft(activeProject?.name ?? "");
  }, [activeProject?.id, activeProject?.name]);

  useEffect(() => {
    setDocumentTitleDraft(activeDocument?.title ?? "");
  }, [activeDocument?.id, activeDocument?.title]);

  useEffect(() => {
    setDocumentTitleDrafts((current) => {
      const next = { ...current };
      for (const document of openDocumentsById.values()) {
        if (next[document.id] === undefined) {
          next[document.id] = document.title;
        }
      }
      return next;
    });
  }, [openDocumentsById]);

  useEffect(() => {
    setEntityNameDraft(selectedEntity?.name ?? "");
  }, [selectedEntity?.id, selectedEntity?.name]);

  const actions = useWorkspaceActions({
    workspaceHook,
    activeProject,
    activeDocument,
    drafts: {
      projectNameDraft,
      documentTitleDraft,
      newFolderTitle,
      newDocumentTitle,
      entityNameDraft,
    },
    setDrafts: {
      setNewFolderTitle,
      setNewDocumentTitle,
    },
    ruleForm,
    setRuleForm,
    selectedEntity,
  });

  const documentsByFolder = useMemo(
    () => groupDocumentsByFolder(workspace?.documents ?? []),
    [workspace?.documents],
  );

  // Slice boundaries are intentionally not painted in the main editor —
  const hoverEntity = hoverPreview ? lookups.entitiesById.get(hoverPreview.entityId) ?? null : null;
  const hoverSlices = hoverPreview && hoverEntity
    ? selectedSlicesForEntity(
        hoverPreview.entityId,
        workspace,
        lookups.slicesById,
        lookups.boundariesBySliceId,
        lookups.documentsById,
      )
    : [];

  const everlinkLabel = everlink.exactSelectionEntityIds.length > 0 ? "Edit Everlink" : "Everlink it!";
  const emptySnapshot = createEmptyHarnessSnapshot();

  const handlePaneSnapshotChange = useCallback((
    document: StoredDocumentSnapshot,
    snapshot: HarnessEditorSnapshot,
    transaction: SerializedTransactionBundle | null,
  ) => {
    if (transaction) {
      workspaceHook.queueDocumentPersistence(
        document.id,
        documentTitleDrafts[document.id] ?? document.title,
        snapshot,
        transaction,
      );
    }
  }, [documentTitleDrafts, workspaceHook]);

  const savePaneDocumentMeta = useCallback((document: StoredDocumentSnapshot, nextFolderId?: string | null) => {
    const title = documentTitleDrafts[document.id] ?? document.title;
    void workspaceHook.runMutation(() => window.evernear.updateDocumentMeta({
      documentId: document.id,
      title,
      folderId: nextFolderId,
    }));
  }, [documentTitleDrafts, workspaceHook]);

  const focusPane = useCallback((paneId: string) => {
    if (workspaceHook.workspaceRef.current?.focusedPaneId === paneId) return;
    void workspaceHook.runMutation(() => window.evernear.focusPane({ paneId }));
  }, [workspaceHook]);

  const closePane = useCallback((paneId: string) => {
    void workspaceHook.runMutation(() => window.evernear.closePane({ paneId }));
  }, [workspaceHook]);

  const movePane = useCallback((paneId: string, placement: WorkspacePane["placement"]) => {
    void workspaceHook.runMutation(() => window.evernear.movePane({ paneId, placement }));
  }, [workspaceHook]);

  const backPane = useCallback((paneId: string) => {
    void workspaceHook.runMutation(() => window.evernear.popPaneContent({ paneId }));
  }, [workspaceHook]);

  const popOutPane = useCallback((paneId: string) => {
    void workspaceHook.runMutation(() => window.evernear.popOutPane({ paneId }));
  }, [workspaceHook]);

  const registerPaneEditor = useCallback((paneId: string, handle: HarnessEditorHandle | null) => {
    if (handle) {
      paneEditorRefs.current.set(paneId, handle);
      if (workspaceHook.workspaceRef.current?.focusedPaneId === paneId) {
        mainEditorRef.current = handle;
      }
    } else {
      paneEditorRefs.current.delete(paneId);
      if (workspaceHook.workspaceRef.current?.focusedPaneId === paneId) {
        mainEditorRef.current = null;
      }
    }
  }, [workspaceHook.workspaceRef]);

  useEffect(() => {
    mainEditorRef.current = focusedPaneId ? paneEditorRefs.current.get(focusedPaneId) ?? null : null;
  }, [focusedPaneId]);

  const hoverCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverPreviewPointerInsideRef = useRef(false);
  const clearHoverCloseTimeout = useCallback(() => {
    if (hoverCloseTimeoutRef.current !== null) {
      clearTimeout(hoverCloseTimeoutRef.current);
      hoverCloseTimeoutRef.current = null;
    }
  }, []);

  const scheduleHoverPreviewClose = useCallback((delayMs: number) => {
    clearHoverCloseTimeout();
    hoverCloseTimeoutRef.current = setTimeout(() => {
      if (!hoverPreviewPointerInsideRef.current) {
        setHoverPreview(null);
      }
      hoverCloseTimeoutRef.current = null;
    }, delayMs);
  }, [clearHoverCloseTimeout]);

  useEffect(() => clearHoverCloseTimeout, [clearHoverCloseTimeout]);

  const handleEditorHover = useCallback((payload: { entityId: string; clientX: number; clientY: number } | null) => {
    if (!payload) {
      scheduleHoverPreviewClose(HOVER_PREVIEW_HANDOFF_DELAY_MS);
      return;
    }
    hoverPreviewPointerInsideRef.current = false;
    clearHoverCloseTimeout();
    setHoverPreview((current) => {
      if (current?.entityId === payload.entityId) {
        return current;
      }
      return { entityId: payload.entityId, x: payload.clientX, y: payload.clientY };
    });
  }, [clearHoverCloseTimeout, scheduleHoverPreviewClose]);

  const handlePreviewEnter = useCallback(() => {
    hoverPreviewPointerInsideRef.current = true;
    clearHoverCloseTimeout();
  }, [clearHoverCloseTimeout]);

  const handlePreviewLeave = useCallback(() => {
    hoverPreviewPointerInsideRef.current = false;
    scheduleHoverPreviewClose(HOVER_PREVIEW_EXIT_DELAY_MS);
  }, [scheduleHoverPreviewClose]);

  const handlePinHoverPreview = useCallback(() => {
    if (!hoverPreview || !hoverEntity) return;
    void workspaceHook.runMutation(() => window.evernear.createPane({
      title: hoverEntity.name,
      content: { kind: "entitySlices", entityId: hoverEntity.id },
    }), "Opened entity slices in a new pane.");
    hoverPreviewPointerInsideRef.current = false;
    clearHoverCloseTimeout();
    setHoverPreview(null);
  }, [hoverPreview, hoverEntity, workspaceHook, clearHoverCloseTimeout]);

  const clearHoverState = useCallback(() => {
    hoverPreviewPointerInsideRef.current = false;
    clearHoverCloseTimeout();
    setHoverPreview(null);
  }, [clearHoverCloseTimeout]);

  const takeOverPaneWithSlice = useCallback((pane: WorkspacePane, sliceView: ResolvedSliceView) => {
    const targetDocumentId = sliceView.boundary?.documentId ?? sliceView.document?.id ?? sliceView.slice.documentId;
    void workspaceHook.runMutation(() => window.evernear.pushPaneContent({
      paneId: pane.id,
      title: sliceView.document?.title ?? "Document",
      content: {
        kind: "document",
        documentId: targetDocumentId,
        focusSliceId: sliceView.slice.id,
        focusAnchor: sliceView.boundary?.resolution.anchor,
      },
    }));
  }, [workspaceHook]);

  const openSliceInNewPane = useCallback((sliceView: ResolvedSliceView) => {
    const targetDocumentId = sliceView.boundary?.documentId ?? sliceView.document?.id ?? sliceView.slice.documentId;
    void workspaceHook.runMutation(() => window.evernear.createPane({
      title: sliceView.document?.title ?? "Document",
      content: {
        kind: "document",
        documentId: targetDocumentId,
        focusSliceId: sliceView.slice.id,
        focusAnchor: sliceView.boundary?.resolution.anchor,
      },
    }));
  }, [workspaceHook]);

  const editorCommands = useEditorCommandActions({
    mainEditorRef,
    selections,
    workspace,
    activeDocument,
    lookups,
    actions,
    openEverlink: everlink.openChooser,
    openEverslice: everslice.open,
    handleSelectionChange: (selection) => everlink.handleSelectionChange("main", selection),
    clearHoverState,
  });

  const renderPane = useCallback((pane: WorkspacePane) => {
    switch (pane.content.kind) {
      case "projectNav":
        return (
          <NavPanel
            workspace={workspace}
            activeDocument={activeDocument}
            projectNameDraft={projectNameDraft}
            newFolderTitle={newFolderTitle}
            newDocumentTitle={newDocumentTitle}
            documentsByFolder={documentsByFolder}
            documentsById={lookups.documentsById}
            onProjectNameChange={setProjectNameDraft}
            onSaveProjectName={actions.saveProjectName}
            onNewFolderTitleChange={setNewFolderTitle}
            onCreateFolder={actions.createFolder}
            onNewDocumentTitleChange={setNewDocumentTitle}
            onCreateDocument={actions.createDocument}
            onToggleFolder={actions.toggleFolder}
            onRenameFolder={actions.renameFolder}
            onDeleteFolder={actions.deleteFolder}
            onOpenDocument={actions.openDocument}
          />
        );
      case "document": {
        const content = pane.content;
        const document = openDocumentsById.get(content.documentId);
        if (!document) {
          return <p className="empty-state">Document is not loaded.</p>;
        }
        return (
          <EditorPane
            ref={(handle) => registerPaneEditor(pane.id, handle)}
            workspace={workspace}
            activeDocument={document}
            status={status}
            documentTitleDraft={documentTitleDrafts[document.id] ?? document.title}
            onDocumentTitleDraftChange={(value) => {
              setDocumentTitleDrafts((current) => ({ ...current, [document.id]: value }));
            }}
            onSaveDocumentMeta={(folderId) => savePaneDocumentMeta(document, folderId)}
            pendingWrites={pendingWrites}
            documentsById={lookups.documentsById}
            emptyDocumentJson={emptySnapshot.contentJson}
            emptyDocumentKey={emptySnapshot.id}
            editorInstanceKey={pane.id === focusedPaneId
              ? `${pane.id}:${document.id}:focused`
              : `${pane.id}:${document.id}:${document.currentVersion}`}
            editorRules={lookups.editorRules}
            visibleBoundaries={content.focusSliceId
              ? (workspace?.sliceBoundaries ?? []).filter((boundary) => boundary.sliceId === content.focusSliceId)
              : []}
            pendingRange={pane.id === focusedPaneId ? everlink.mainPendingRange ?? everslice.frozenPendingRange : null}
            onSnapshotChange={(snapshot, transaction) => handlePaneSnapshotChange(document, snapshot, transaction)}
            onSelectionChange={(selection) => {
              focusPane(pane.id);
              editorCommands.handleMainSelectionChange(selection);
            }}
            onEntityHover={handleEditorHover}
            onEntityClick={editorCommands.openEntityContext}
            onEditorContextMenu={editorCommands.handleEditorContextMenu}
            onEditorBlur={() => void everlink.handleMainBlur()}
          />
        );
      }
      case "entitySlices": {
        const content = pane.content;
        const entity = lookups.entitiesById.get(content.entityId) ?? null;
        const slices = selectedSlicesForEntity(
          content.entityId,
          workspace,
          lookups.slicesById,
          lookups.boundariesBySliceId,
          lookups.documentsById,
        );
        return (
          <EntitySlicesPane
            entity={entity}
            slices={slices}
            onTakeOverPane={(slice) => takeOverPaneWithSlice(pane, slice)}
            onOpenNewPane={openSliceInNewPane}
            onDeleteSlice={actions.deleteSlice}
          />
        );
      }
      case "entityDetail": {
        const content = pane.content;
        const entity = lookups.entitiesById.get(content.entityId) ?? null;
        if (!entity) return <p className="empty-state">Entity not found.</p>;
        return (
          <div className="pane-section">
            <EntityDetail
              entityNameDraft={entity.id === selectedEntity?.id ? entityNameDraft : entity.name}
              onEntityNameDraftChange={setEntityNameDraft}
              onSaveEntityName={actions.saveEntityName}
              onDeleteEntity={actions.deleteEntity}
            />
          </div>
        );
      }
      case "matchingRules": {
        const content = pane.content;
        const rules = workspace?.matchingRules.filter((rule) => rule.entityId === content.entityId) ?? [];
        return (
          <MatchingRuleEditor
            ruleForm={ruleForm}
            selectedEntityRules={rules}
            onRuleFormChange={setRuleForm}
            onAddRule={actions.createEntityRule}
            onToggleRule={actions.toggleRule}
            onDeleteRule={actions.deleteRule}
          />
        );
      }
    }
  }, [
    actions,
    activeDocument,
    documentTitleDrafts,
    documentsByFolder,
    editorCommands,
    emptySnapshot.contentJson,
    emptySnapshot.id,
    entityNameDraft,
    everslice.frozenPendingRange,
    everlink,
    focusPane,
    focusedPaneId,
    handleEditorHover,
    handlePaneSnapshotChange,
    lookups,
    newDocumentTitle,
    newFolderTitle,
    openDocumentsById,
    openSliceInNewPane,
    pendingWrites,
    projectNameDraft,
    registerPaneEditor,
    ruleForm,
    savePaneDocumentMeta,
    selectedEntity?.id,
    setRuleForm,
    status,
    takeOverPaneWithSlice,
    workspace,
  ]);

  return (
    <div className="mvp-shell">
      <TitleBar
        workspace={workspace}
        hasActiveDocument={activeDocument !== null}
        everlinkLabel={everlinkLabel}
        everlinkDisabled={selections.mainSelection.empty}
        eversliceDisabled={selections.mainSelection.empty}
        fullScreen={editorFullScreen}
        shortcutsActive={activeScreen === "shortcuts"}
        onProjectSwitch={actions.switchProject}
        onCreateProject={actions.createProject}
        onTogglePanel={actions.togglePanel}
        onToggleBold={editorCommands.toggleBold}
        onToggleItalic={editorCommands.toggleItalic}
        onUndo={editorCommands.undo}
        onRedo={editorCommands.redo}
        onReorderDocument={actions.reorderDocument}
        onToggleHighlights={actions.toggleHighlights}
        onToggleFullScreen={() => setEditorFullScreen((value) => !value)}
        onOpenEverslice={editorCommands.openEverslice}
        onOpenEverlinkChooser={editorCommands.openEverlink}
        onDeleteDocument={actions.deleteDocument}
        onOpenShortcuts={() => {
          editorCommands.closeEditorContextMenu();
          setActiveScreen("shortcuts");
        }}
      />

      {activeScreen === "shortcuts" ? (
        <HowToUsePage onBackToWorkspace={() => setActiveScreen("workspace")} />
      ) : (
        <PaneWorkspace
          panes={renderedPanes}
          focusedPaneId={nativePaneId ?? focusedPaneId}
          renderPane={renderPane}
          onFocusPane={focusPane}
          onClosePane={closePane}
          onBackPane={backPane}
          onPopOutPane={popOutPane}
          onMovePane={movePane}
        />
      )}

      {activeScreen === "workspace" ? (
        <EditorActionOverlays
          selection={selections.mainSelection}
          contextMenu={editorCommands.editorContextMenu}
          everlinkLabel={everlinkLabel}
          eversliceDisabled={selections.mainSelection.empty}
          highlightsEnabled={workspace?.layout.highlightsEnabled ?? false}
          onBold={editorCommands.toggleBold}
          onItalic={editorCommands.toggleItalic}
          onOpenEverlink={editorCommands.openEverlink}
          onOpenEverslice={editorCommands.openEverslice}
          onOpenEntityContext={editorCommands.openEntityContext}
          onSelectEntity={editorCommands.selectEntityFromMenu}
          onToggleHighlights={editorCommands.toggleHighlightsFromMenu}
          onCopySelection={editorCommands.copySelection}
          onSelectAll={editorCommands.selectAll}
          onCloseContextMenu={editorCommands.closeEditorContextMenu}
        />
      ) : null}

      {activeScreen === "workspace" && hoverPreview ? (
        <HoverPreview
          hover={hoverPreview}
          entity={hoverEntity}
          slices={hoverSlices}
          onMouseEnter={handlePreviewEnter}
          onMouseLeave={handlePreviewLeave}
          onPin={handlePinHoverPreview}
        />
      ) : null}

      <EversliceChooser
        isOpen={everslice.isOpen}
        sourceText={everslice.sourceText}
        workspace={workspace}
        onClose={everslice.close}
        onConfirmExisting={(entityId) => void everslice.confirmExisting(entityId)}
        onConfirmNew={(name) => void everslice.confirmNew(name)}
      />
    </div>
  );
}

