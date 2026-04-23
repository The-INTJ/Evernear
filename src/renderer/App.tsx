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
import { EverlinkPanel } from "./features/entities/EverlinkPanel";
import { EversliceChooser } from "./features/entities/EversliceChooser";
import { SlicePlacementPanel } from "./features/panes/SlicePlacementPanel";
import { EntityList } from "./features/entities/EntityList";
import { EntityDetail } from "./features/entities/EntityDetail";
import { MatchingRuleEditor } from "./features/entities/MatchingRuleEditor";
import { SliceViewer } from "./features/panes/SliceViewer";
import { PanelDocumentView } from "./features/panes/PanelDocumentView";
import { HoverPreview } from "./features/panes/HoverPreview";
import { HowToUsePage } from "./features/help/HowToUsePage";
import { RunLog } from "./features/history/RunLog";
import { DEBUG_PANELS } from "./utils/devFlags";

export function App() {
  const mainEditorRef = useRef<HarnessEditorHandle | null>(null);
  const panelEditorRef = useRef<HarnessEditorHandle | null>(null);

  const workspaceHook = useWorkspace();
  const { status, workspace, pendingWrites, runLog } = workspaceHook;

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
  const activeDocument = workspace?.activeDocument ?? null;
  const panelDocument = workspace?.panelDocument ?? null;
  const selectedEntity = getSelectedEntity(workspace);

  // Draft text state — short-lived typing state that doesn't belong in
  // the persisted workspace. Kept at shell level because multiple feature
  // components read and write these.
  const [projectNameDraft, setProjectNameDraft] = useState("");
  const [documentTitleDraft, setDocumentTitleDraft] = useState("");
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

  const selectedEntitySlices = useMemo(() => {
    if (!selectedEntity) return [];
    return selectedSlicesForEntity(
      selectedEntity.id,
      workspace,
      lookups.slicesById,
      lookups.boundariesBySliceId,
      lookups.documentsById,
    );
  }, [workspace, selectedEntity, lookups.slicesById, lookups.boundariesBySliceId, lookups.documentsById]);

  const selectedEntityRules = useMemo(() => {
    if (!selectedEntity || !workspace) return [];
    return workspace.matchingRules.filter((rule) => rule.entityId === selectedEntity.id);
  }, [workspace, selectedEntity]);

  // Slice boundaries are intentionally not painted in the main editor —
  // it stays a pure writing surface. Boundaries only appear in the hover
  // preview and the docked panel (PanelDocumentView).
  const panelVisibleBoundaries = useMemo(() => {
    if (!workspace || !panelDocument) return [];
    const selectedSliceIds = new Set<string>(
      selectedEntity
        ? workspace.entitySlices.filter((link) => link.entityId === selectedEntity.id).map((link) => link.sliceId)
        : [],
    );
    return workspace.sliceBoundaries.filter((boundary) =>
      boundary.documentId === panelDocument.id
      && (selectedSliceIds.size === 0 || selectedSliceIds.has(boundary.sliceId)));
  }, [workspace, panelDocument, selectedEntity]);

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

  const handleMainSnapshotChange = useCallback((
    snapshot: HarnessEditorSnapshot,
    transaction: SerializedTransactionBundle | null,
  ) => {
    if (transaction && activeDocument) {
      workspaceHook.queueDocumentPersistence(
        activeDocument.id,
        documentTitleDraft || activeDocument.title,
        snapshot,
        transaction,
      );
    }
  }, [activeDocument, documentTitleDraft, workspaceHook]);

  const handlePanelSnapshotChange = useCallback((
    snapshot: HarnessEditorSnapshot,
    transaction: SerializedTransactionBundle | null,
  ) => {
    if (transaction && panelDocument) {
      workspaceHook.queueDocumentPersistence(
        panelDocument.id,
        panelDocument.title,
        snapshot,
        transaction,
      );
    }
  }, [panelDocument, workspaceHook]);

  const hoverCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearHoverCloseTimeout = useCallback(() => {
    if (hoverCloseTimeoutRef.current !== null) {
      clearTimeout(hoverCloseTimeoutRef.current);
      hoverCloseTimeoutRef.current = null;
    }
  }, []);

  const handleEditorHover = useCallback((payload: { entityId: string; clientX: number; clientY: number } | null) => {
    if (!payload) {
      clearHoverCloseTimeout();
      hoverCloseTimeoutRef.current = setTimeout(() => {
        setHoverPreview(null);
        hoverCloseTimeoutRef.current = null;
      }, 350);
      return;
    }
    clearHoverCloseTimeout();
    setHoverPreview({ entityId: payload.entityId, x: payload.clientX, y: payload.clientY });
  }, [clearHoverCloseTimeout]);

  const handlePreviewEnter = useCallback(() => {
    clearHoverCloseTimeout();
  }, [clearHoverCloseTimeout]);

  const handlePreviewLeave = useCallback(() => {
    clearHoverCloseTimeout();
    setHoverPreview(null);
  }, [clearHoverCloseTimeout]);

  const handlePinHoverPreview = useCallback(() => {
    if (!hoverPreview || !hoverEntity) return;
    const firstSlice = hoverSlices[0];
    const targetDocumentId = firstSlice?.boundary?.documentId
      ?? firstSlice?.document?.id
      ?? activeDocument?.id
      ?? null;
    if (targetDocumentId) {
      actions.openSliceInPanel(targetDocumentId, hoverEntity.id);
    } else {
      actions.selectEntity(hoverEntity.id);
    }
    clearHoverCloseTimeout();
    setHoverPreview(null);
  }, [hoverPreview, hoverEntity, hoverSlices, activeDocument, actions, clearHoverCloseTimeout]);

  const clearHoverState = useCallback(() => {
    clearHoverCloseTimeout();
    setHoverPreview(null);
  }, [clearHoverCloseTimeout]);

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
      <main className={mainGridClassName(workspace?.layout.panelOpen, editorFullScreen)}>
        {editorFullScreen ? null : (
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
        )}

        <EditorPane
          ref={mainEditorRef}
          workspace={workspace}
          activeDocument={activeDocument}
          status={status}
          documentTitleDraft={documentTitleDraft}
          onDocumentTitleDraftChange={setDocumentTitleDraft}
          onSaveDocumentMeta={actions.saveDocumentMeta}
          pendingWrites={pendingWrites}
          documentsById={lookups.documentsById}
          emptyDocumentJson={emptySnapshot.contentJson}
          emptyDocumentKey={emptySnapshot.id}
          editorRules={lookups.editorRules}
          visibleBoundaries={[]}
          pendingRange={everlink.mainPendingRange ?? everslice.frozenPendingRange}
          onSnapshotChange={handleMainSnapshotChange}
          onSelectionChange={editorCommands.handleMainSelectionChange}
          onEntityHover={handleEditorHover}
          onEntityClick={editorCommands.openEntityContext}
          onEditorContextMenu={editorCommands.handleEditorContextMenu}
          onEditorBlur={() => void everlink.handleMainBlur()}
        />

        {workspace?.layout.panelOpen && !editorFullScreen ? (
          <aside className="panel-stack">
            {everlink.everlinkSession ? (
              <EverlinkPanel
                session={everlink.everlinkSession}
                workspace={workspace}
                documentsById={lookups.documentsById}
                onSessionChange={everlink.setSession}
                onBeginPlacement={() => void everlink.beginPlacement()}
                onCreateTargetDocument={() => void everlink.createTargetDocumentFromChooser()}
                onCancel={() => void everlink.cancelFlow()}
              />
            ) : null}

            {everlink.pendingPlacement ? (
              <SlicePlacementPanel
                placement={everlink.pendingPlacement}
                documentsById={lookups.documentsById}
                onCommit={() => void everlink.commitPendingSlice()}
                onCancel={() => void everlink.cancelFlow()}
              />
            ) : null}

            {!everlink.everlinkSession && !everlink.pendingPlacement ? (
              <>
                <EntityList
                  workspace={workspace}
                  selectedEntity={selectedEntity}
                  onSelectEntity={actions.selectEntity}
                  onCreateManualEntity={actions.createManualEntity}
                />

                {selectedEntity ? (
                  <>
                    <EntityDetail
                      entityNameDraft={entityNameDraft}
                      onEntityNameDraftChange={setEntityNameDraft}
                      onSaveEntityName={actions.saveEntityName}
                      onDeleteEntity={actions.deleteEntity}
                    />

                    <MatchingRuleEditor
                      ruleForm={ruleForm}
                      selectedEntityRules={selectedEntityRules}
                      onRuleFormChange={setRuleForm}
                      onAddRule={actions.createEntityRule}
                      onToggleRule={actions.toggleRule}
                      onDeleteRule={actions.deleteRule}
                    />

                    <SliceViewer
                      selectedEntity={selectedEntity}
                      entitySlices={selectedEntitySlices}
                      onOpenSliceInPanel={actions.openSliceInPanel}
                      onDeleteSlice={actions.deleteSlice}
                    />

                    {panelDocument ? (
                      <PanelDocumentView
                        ref={panelEditorRef}
                        snapshot={panelDocument}
                        boundaries={panelVisibleBoundaries}
                        pendingRange={everlink.panelPendingRange}
                        onSnapshotChange={handlePanelSnapshotChange}
                        onSelectionChange={(selection) => everlink.handleSelectionChange("panel", selection)}
                        onBlur={() => void everlink.handlePanelBlur()}
                        onClose={actions.closePanelDocument}
                      />
                    ) : null}
                  </>
                ) : null}
              </>
            ) : null}

            {DEBUG_PANELS ? <RunLog entries={runLog} /> : null}
          </aside>
        ) : null}
      </main>
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

function mainGridClassName(panelOpen: boolean | undefined, fullScreen: boolean): string {
  if (fullScreen) return "mvp-grid mvp-grid--fullscreen";
  return panelOpen ? "mvp-grid" : "mvp-grid mvp-grid--panel-closed";
}
