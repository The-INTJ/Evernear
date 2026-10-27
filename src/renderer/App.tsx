// App shell — composes hooks and feature components. Behavior lives in
// the hooks under src/renderer/state/ and the feature components under
// src/renderer/features/. This file owns top-level layout, draft text
// state (project name, document title), which entity's dialog is open,
// and the editor ref.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createEmptyHarnessSnapshot } from "../shared/domain/harnessFixture";
import type { SliceBoundaryRecord } from "../shared/domain/workspace";
import type { HarnessEditorHandle, HarnessEditorSnapshot } from "./editor/HarnessEditor";
import type { EditorMatchingRule, SerializedTransactionBundle } from "./editor/editorUtils";

import { useEditorSelections } from "./state/useEditorSelections";
import { useEverslicePlacement } from "./state/useEverslicePlacement";
import { useGlobalShortcuts } from "./state/useGlobalShortcuts";
import { useHoverPreview } from "./state/useHoverPreview";
import { useSliceNavigation } from "./state/useSliceNavigation";
import { useWorkspace } from "./state/useWorkspace";
import { useWorkspaceActions } from "./state/useWorkspaceActions";
import { useWorkspaceLookups } from "./state/useWorkspaceLookups";
import { entityMatchingText, getActiveProject } from "./utils/workspace";

import { NoticeBar } from "./features/chrome/NoticeBar";
import { TitleBar } from "./features/chrome/TitleBar";
import { EditorPane } from "./features/documents/EditorPane";
import { NavPanel } from "./features/documents/NavPanel";
import { SelectionBubble } from "./features/documents/SelectionBubble";
import { EntityDialog } from "./features/entities/EntityDialog";
import { EversliceChooser } from "./features/entities/EversliceChooser";
import { HoverPreview } from "./features/panes/HoverPreview";

// Stable empties, so toggling highlights off doesn't hand the editor a new
// array (and a decoration pass) on every render.
const NO_RULES: EditorMatchingRule[] = [];
const NO_BOUNDARIES: SliceBoundaryRecord[] = [];
const EMPTY_SNAPSHOT = createEmptyHarnessSnapshot();

export function App() {
  const mainEditorRef = useRef<HarnessEditorHandle | null>(null);

  const workspaceHook = useWorkspace();
  const { workspace, pendingWrites, saveError, notice, dismissNotice } = workspaceHook;

  const selections = useEditorSelections();
  const lookups = useWorkspaceLookups(workspace);
  const everslice = useEverslicePlacement({ workspaceHook, selections, editorRef: mainEditorRef });
  const sliceNavigation = useSliceNavigation({ workspaceHook, lookups, editorRef: mainEditorRef });
  const hover = useHoverPreview({ lookups, workspace });

  const activeProject = getActiveProject(workspace);
  const activeDocument = workspace?.activeDocument ?? null;
  const layout = workspace?.layout ?? null;

  const [projectNameDraft, setProjectNameDraft] = useState("");
  const [documentTitleDraft, setDocumentTitleDraft] = useState("");
  const [newFolderTitle, setNewFolderTitle] = useState("");
  const [newDocumentTitle, setNewDocumentTitle] = useState("");
  const [dialogEntityId, setDialogEntityId] = useState<string | null>(null);

  useEffect(() => {
    setProjectNameDraft(activeProject?.name ?? "");
  }, [activeProject?.id, activeProject?.name]);

  useEffect(() => {
    setDocumentTitleDraft(activeDocument?.title ?? "");
  }, [activeDocument?.id, activeDocument?.title]);

  const actions = useWorkspaceActions({
    workspaceHook,
    activeProject,
    activeDocument,
    drafts: { projectNameDraft, documentTitleDraft, newFolderTitle, newDocumentTitle },
    setDrafts: { setNewFolderTitle, setNewDocumentTitle },
  });

  useGlobalShortcuts({ toggleHighlights: actions.toggleHighlights, toggleSlices: actions.toggleSlices });

  const matchingRules = layout?.highlightsEnabled ? lookups.editorRules : NO_RULES;
  const sliceBoundaries = useMemo(() => {
    if (!workspace?.layout.slicesVisible || !activeDocument) return NO_BOUNDARIES;
    return workspace.sliceBoundaries.filter((boundary) => boundary.documentId === activeDocument.id);
  }, [workspace, activeDocument]);

  const { mainSelection } = selections;
  const matchedEntity = useMemo(
    () => (mainSelection.empty ? null : entityMatchingText(lookups.editorRules, mainSelection.text)),
    [lookups.editorRules, mainSelection],
  );

  const dialogEntity = dialogEntityId ? (lookups.entitiesById.get(dialogEntityId) ?? null) : null;
  const dialogRules = useMemo(
    () => workspace?.matchingRules.filter((rule) => rule.entityId === dialogEntityId) ?? [],
    [workspace, dialogEntityId],
  );
  const dialogSliceCount = workspace?.entitySlices.filter((link) => link.entityId === dialogEntityId).length ?? 0;
  const modalOpen = everslice.isOpen || dialogEntity !== null;

  const handleMainSnapshotChange = useCallback(
    (snapshot: HarnessEditorSnapshot, transaction: SerializedTransactionBundle | null) => {
      if (transaction && activeDocument) {
        workspaceHook.queueDocumentPersistence(
          activeDocument.id,
          documentTitleDraft || activeDocument.title,
          snapshot,
          transaction,
        );
      }
    },
    [activeDocument, documentTitleDraft, workspaceHook],
  );

  const { clearHoverState } = hover;
  const openEntityDialog = useCallback((entityId: string) => {
    clearHoverState();
    setDialogEntityId(entityId);
  }, [clearHoverState]);

  const { openSlice } = sliceNavigation;
  const openSliceFromHover = useCallback((sliceId: string) => {
    clearHoverState();
    openSlice(sliceId);
  }, [clearHoverState, openSlice]);

  return (
    <div className="mvp-shell">
      <TitleBar
        activeDocument={activeDocument}
        documentTitleDraft={documentTitleDraft}
        onDocumentTitleDraftChange={setDocumentTitleDraft}
        onSaveDocumentMeta={() => actions.saveDocumentMeta()}
        highlightsEnabled={layout?.highlightsEnabled ?? false}
        slicesVisible={layout?.slicesVisible ?? false}
        onToggleHighlights={actions.toggleHighlights}
        onToggleSlices={actions.toggleSlices}
        pendingWrites={pendingWrites}
        saveError={saveError}
      />

      <main className="mvp-grid">
        <NavPanel
          workspace={workspace}
          activeDocument={activeDocument}
          projectNameDraft={projectNameDraft}
          activeProjectId={layout?.activeProjectId ?? ""}
          documentsById={lookups.documentsById}
          onProjectNameChange={setProjectNameDraft}
          onSaveProjectName={actions.saveProjectName}
          onProjectSwitch={actions.switchProject}
          onCreateProject={actions.createProject}
          onCreateFolder={actions.createFolder}
          onCreateDocument={actions.createDocument}
          onToggleFolder={actions.toggleFolder}
          onRenameFolder={actions.renameFolder}
          onDeleteFolder={actions.deleteFolder}
          onMoveFolder={actions.moveFolder}
          onRenameDocument={actions.renameDocument}
          onDeleteDocument={actions.deleteDocumentById}
          onMoveDocument={actions.moveDocument}
          onOpenDocument={actions.openDocument}
        />

        <EditorPane
          ref={mainEditorRef}
          activeDocument={activeDocument}
          emptyDocumentJson={EMPTY_SNAPSHOT.contentJson}
          emptyDocumentKey={EMPTY_SNAPSHOT.id}
          matchingRules={matchingRules}
          sliceBoundaries={sliceBoundaries}
          pendingRange={everslice.frozenPendingRange}
          onSnapshotChange={handleMainSnapshotChange}
          onSelectionChange={selections.setMainSelection}
          onEntityHover={hover.handleEditorHover}
        />
      </main>

      {modalOpen ? null : (
        <SelectionBubble
          selection={mainSelection}
          matchedEntity={matchedEntity}
          onNewEntity={() => actions.createEntityFromText(mainSelection.text)}
          onEditEntity={openEntityDialog}
          onAddSlice={everslice.open}
        />
      )}

      {hover.hoverPreview && !modalOpen ? (
        <HoverPreview
          hover={hover.hoverPreview}
          entity={hover.hoverEntity}
          slices={hover.hoverSlices}
          onMouseEnter={hover.handlePreviewEnter}
          onMouseLeave={hover.handlePreviewLeave}
          onOpenSlice={openSliceFromHover}
          onOpenEntity={openEntityDialog}
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

      {dialogEntity ? (
        <EntityDialog
          key={dialogEntity.id}
          entity={dialogEntity}
          rules={dialogRules}
          sliceCount={dialogSliceCount}
          onSave={actions.saveEntity}
          onDelete={actions.deleteEntity}
          onClose={() => setDialogEntityId(null)}
        />
      ) : null}

      <NoticeBar notice={notice} onDismiss={dismissNotice} />
    </div>
  );
}
