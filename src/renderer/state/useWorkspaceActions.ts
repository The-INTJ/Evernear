// Thin IPC-wrapper handlers for project / folder / document / entity / rule /
// slice mutations. Every handler here ends in `runMutation(() => window.evernear.xyz(...))`
// — they're the glue between feature components and the workspace hook.
//
// Why a hook instead of free functions: most of these need fresh references
// to workspace state, drafts, and active document IDs. Stuffing them into
// a hook keeps dependency arrays honest and gives each feature component
// a stable callback reference.

import { useCallback } from "react";

import type {
  DocumentFolderRecord,
  MatchingRuleRecord,
  ProjectRecord,
  WorkspaceState,
} from "../../shared/domain/workspace";
import type { StoredDocumentSnapshot } from "../../shared/domain/document";
import { countForLabel } from "../utils/formatting";
import type { RuleFormState } from "./sessionTypes";
import { initialRuleForm } from "./sessionTypes";
import type { WorkspaceHook } from "./useWorkspace";

type UseWorkspaceActionsInput = {
  workspaceHook: WorkspaceHook;
  activeProject: ProjectRecord | null;
  activeDocument: StoredDocumentSnapshot | null;
  drafts: {
    projectNameDraft: string;
    documentTitleDraft: string;
    newFolderTitle: string;
    newDocumentTitle: string;
    entityNameDraft: string;
  };
  setDrafts: {
    setNewFolderTitle: React.Dispatch<React.SetStateAction<string>>;
    setNewDocumentTitle: React.Dispatch<React.SetStateAction<string>>;
  };
  ruleForm: RuleFormState;
  setRuleForm: React.Dispatch<React.SetStateAction<RuleFormState>>;
  selectedEntity: { id: string; name: string } | null;
};

export type WorkspaceActions = {
  switchProject: (projectId: string) => void;
  createProject: () => void;
  saveProjectName: () => void;
  createFolder: () => void;
  createDocument: (folderId: string | null, openInPanel?: boolean) => void;
  openDocument: (documentId: string) => void;
  saveDocumentMeta: (nextFolderId?: string | null) => void;
  deleteDocument: () => void;
  reorderDocument: (direction: "up" | "down") => void;
  toggleFolder: (folderId: string) => void;
  renameFolder: (folder: DocumentFolderRecord, title: string) => void;
  deleteFolder: (folderId: string) => void;
  toggleHighlights: () => void;
  togglePanel: () => void;
  selectEntity: (entityId: string) => void;
  saveEntityName: () => void;
  createEntityRule: () => void;
  createManualEntity: () => void;
  toggleRule: (rule: MatchingRuleRecord) => void;
  deleteRule: (ruleId: string) => void;
  deleteEntity: () => void;
  deleteSlice: (sliceId: string) => void;
  openSliceInPanel: (documentId: string, entityId: string) => void;
  closePanelDocument: () => void;
};

export function useWorkspaceActions(input: UseWorkspaceActionsInput): WorkspaceActions {
  const {
    workspaceHook: { runMutation, applyWorkspace, appendLog, workspaceRef },
    activeProject,
    activeDocument,
    drafts,
    setDrafts,
    ruleForm,
    setRuleForm,
    selectedEntity,
  } = input;

  // Workspace reads via the ref so callbacks don't need to depend on a
  // changing workspace reference on every render.
  const currentWorkspace = (): WorkspaceState | null => workspaceRef.current;

  const switchProject = useCallback((projectId: string) => {
    const ws = currentWorkspace();
    if (!projectId || projectId === ws?.layout.activeProjectId) return;
    void runMutation(() => window.evernear.openProject({ projectId }), "Opened the selected project.");
  }, [runMutation, workspaceRef]);

  const createProject = useCallback(() => {
    const ws = currentWorkspace();
    const nextIndex = (ws?.projects.length ?? 0) + 1;
    void runMutation(
      () => window.evernear.createProject({ name: `Untitled Project ${nextIndex}` }),
      "Created a fresh local project.",
    );
  }, [runMutation, workspaceRef]);

  const saveProjectName = useCallback(() => {
    if (!activeProject || drafts.projectNameDraft.trim() === activeProject.name) return;
    void runMutation(
      () => window.evernear.updateProject({ projectId: activeProject.id, name: drafts.projectNameDraft }),
      "Updated the project name.",
    );
  }, [runMutation, activeProject, drafts.projectNameDraft]);

  const createFolder = useCallback(() => {
    if (!activeProject) return;
    const ws = currentWorkspace();
    const title = drafts.newFolderTitle.trim() || `Folder ${countForLabel(ws?.folders.length ?? 0)}`;
    setDrafts.setNewFolderTitle("");
    void runMutation(
      () => window.evernear.createFolder({ projectId: activeProject.id, title }),
      `Created folder "${title}".`,
    );
  }, [runMutation, activeProject, drafts.newFolderTitle, setDrafts, workspaceRef]);

  const createDocument = useCallback((folderId: string | null, openInPanel = false) => {
    if (!activeProject) return;
    const ws = currentWorkspace();
    const title = drafts.newDocumentTitle.trim() || `Document ${countForLabel(ws?.documents.length ?? 0)}`;
    setDrafts.setNewDocumentTitle("");
    void runMutation(
      () => window.evernear.createDocument({ projectId: activeProject.id, folderId, title, openInPanel }),
      `Created document "${title}".`,
    );
  }, [runMutation, activeProject, drafts.newDocumentTitle, setDrafts, workspaceRef]);

  const openDocument = useCallback((documentId: string) => {
    void runMutation(
      () => window.evernear.openDocument({ documentId, surface: "main" }),
      "Opened the selected document.",
    );
  }, [runMutation]);

  const saveDocumentMeta = useCallback((nextFolderId?: string | null) => {
    if (!activeDocument) return;
    void runMutation(
      () => window.evernear.updateDocumentMeta({
        documentId: activeDocument.id,
        title: drafts.documentTitleDraft.trim() || activeDocument.title,
        folderId: nextFolderId === undefined ? undefined : nextFolderId,
      }),
      "Updated document metadata.",
    );
  }, [runMutation, activeDocument, drafts.documentTitleDraft]);

  const deleteDocument = useCallback(() => {
    if (!activeDocument) return;
    void runMutation(
      () => window.evernear.deleteDocument({ documentId: activeDocument.id }),
      `Deleted "${activeDocument.title}".`,
    );
  }, [runMutation, activeDocument]);

  const reorderDocument = useCallback((direction: "up" | "down") => {
    if (!activeDocument) return;
    void runMutation(
      () => window.evernear.reorderDocument({ documentId: activeDocument.id, direction }),
      `Moved "${activeDocument.title}" ${direction}.`,
    );
  }, [runMutation, activeDocument]);

  const toggleFolder = useCallback((folderId: string) => {
    const ws = currentWorkspace();
    if (!ws) return;
    const expanded = ws.layout.expandedFolderIds.includes(folderId);
    void runMutation(() => window.evernear.updateLayout({
      expandedFolderIds: expanded
        ? ws.layout.expandedFolderIds.filter((id) => id !== folderId)
        : [...ws.layout.expandedFolderIds, folderId],
    }));
  }, [runMutation, workspaceRef]);

  const renameFolder = useCallback((folder: DocumentFolderRecord, title: string) => {
    if (title.trim() === folder.title) return;
    void runMutation(
      () => window.evernear.updateFolder({ folderId: folder.id, title }),
      "Updated folder title.",
    );
  }, [runMutation]);

  const deleteFolder = useCallback((folderId: string) => {
    void runMutation(
      () => window.evernear.deleteFolder({ folderId }),
      "Deleted the folder and moved its documents to the project root.",
    );
  }, [runMutation]);

  const toggleHighlights = useCallback(() => {
    const ws = currentWorkspace();
    if (!ws) return;
    void runMutation(() => window.evernear.updateLayout({ highlightsEnabled: !ws.layout.highlightsEnabled }));
  }, [runMutation, workspaceRef]);

  const togglePanel = useCallback(() => {
    const ws = currentWorkspace();
    if (!ws) return;
    void runMutation(() => window.evernear.updateLayout({ panelOpen: !ws.layout.panelOpen }));
  }, [runMutation, workspaceRef]);

  const selectEntity = useCallback((entityId: string) => {
    void runMutation(() => window.evernear.updateLayout({
      selectedEntityId: entityId,
      panelOpen: true,
      panelMode: "entities",
    }));
  }, [runMutation]);

  const saveEntityName = useCallback(() => {
    if (!selectedEntity || drafts.entityNameDraft.trim() === selectedEntity.name) return;
    void runMutation(
      () => window.evernear.updateEntity({ entityId: selectedEntity.id, name: drafts.entityNameDraft }),
      "Updated the entity name.",
    );
  }, [runMutation, selectedEntity, drafts.entityNameDraft]);

  const createEntityRule = useCallback(() => {
    if (!selectedEntity) return;
    if (ruleForm.pattern.trim().length === 0 || ruleForm.label.trim().length === 0) {
      appendLog("Matching rules need both a label and a pattern.", "warn");
      return;
    }
    const form = ruleForm;
    setRuleForm(initialRuleForm);
    void runMutation(
      () => window.evernear.upsertMatchingRule({
        entityId: selectedEntity.id,
        label: form.label.trim(),
        kind: form.kind,
        pattern: form.pattern,
        wholeWord: form.wholeWord,
        allowPossessive: form.allowPossessive,
        enabled: form.enabled,
      }),
      `Added rule "${form.label.trim()}".`,
    );
  }, [runMutation, selectedEntity, ruleForm, setRuleForm, appendLog]);

  const createManualEntity = useCallback(() => {
    if (!activeProject) return;
    const ws = currentWorkspace();
    const nextIndex = (ws?.entities.length ?? 0) + 1;
    void runMutation(
      () => window.evernear.createEntity({ projectId: activeProject.id, name: `Entity ${nextIndex}` }),
      "Created a new empty entity.",
    );
  }, [runMutation, activeProject, workspaceRef]);

  const toggleRule = useCallback((rule: MatchingRuleRecord) => {
    void runMutation(() => window.evernear.upsertMatchingRule({
      id: rule.id,
      entityId: rule.entityId,
      label: rule.label,
      kind: rule.kind,
      pattern: rule.pattern,
      wholeWord: rule.wholeWord,
      allowPossessive: rule.allowPossessive,
      enabled: !rule.enabled,
    }));
  }, [runMutation]);

  const deleteRule = useCallback((ruleId: string) => {
    void runMutation(() => window.evernear.deleteMatchingRule({ ruleId }), "Deleted the matching rule.");
  }, [runMutation]);

  const deleteEntity = useCallback(() => {
    if (!selectedEntity) return;
    void runMutation(
      () => window.evernear.deleteEntity({ entityId: selectedEntity.id }),
      `Deleted "${selectedEntity.name}" and cleaned up orphaned slice records.`,
    );
  }, [runMutation, selectedEntity]);

  const deleteSlice = useCallback((sliceId: string) => {
    void runMutation(() => window.evernear.deleteSlice({ sliceId }), "Deleted the slice.");
  }, [runMutation]);

  const openSliceInPanel = useCallback((documentId: string, entityId: string) => {
    void (async () => {
      const next = await window.evernear.openDocument({ documentId, surface: "panel" });
      applyWorkspace(next, "Opened the slice document in the persistent panel.");
      await runMutation(() => window.evernear.updateLayout({
        selectedEntityId: entityId,
        panelMode: "document",
        panelOpen: true,
      }));
    })();
  }, [runMutation, applyWorkspace]);

  const closePanelDocument = useCallback(() => {
    void runMutation(() => window.evernear.updateLayout({ panelMode: "entities" }));
  }, [runMutation]);

  return {
    switchProject,
    createProject,
    saveProjectName,
    createFolder,
    createDocument,
    openDocument,
    saveDocumentMeta,
    deleteDocument,
    reorderDocument,
    toggleFolder,
    renameFolder,
    deleteFolder,
    toggleHighlights,
    togglePanel,
    selectEntity,
    saveEntityName,
    createEntityRule,
    createManualEntity,
    toggleRule,
    deleteRule,
    deleteEntity,
    deleteSlice,
    openSliceInPanel,
    closePanelDocument,
  };
}
