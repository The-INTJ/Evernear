// Folder + document IPC wrappers. Folders and documents are split out
// here together because the folder API surface is so small (4 callbacks)
// and is always used alongside document mutations in the same UI panes.

import { useCallback } from "react";

import type {
  DocumentFolderRecord,
  ProjectRecord,
  WorkspaceState,
} from "../../shared/domain/workspace";
import type { StoredDocumentSnapshot } from "../../shared/domain/document";
import { countForLabel } from "../utils/formatting";
import type { WorkspaceHook } from "./useWorkspace";

type UseDocumentActionsInput = {
  workspaceHook: WorkspaceHook;
  activeProject: ProjectRecord | null;
  activeDocument: StoredDocumentSnapshot | null;
  drafts: {
    documentTitleDraft: string;
    newFolderTitle: string;
    newDocumentTitle: string;
  };
  setDrafts: {
    setNewFolderTitle: React.Dispatch<React.SetStateAction<string>>;
    setNewDocumentTitle: React.Dispatch<React.SetStateAction<string>>;
  };
};

export type DocumentActions = {
  createFolder: (titleOverride?: string) => void;
  createDocument: (folderId: string | null, openInPanel?: boolean, titleOverride?: string) => void;
  openDocument: (documentId: string) => void;
  saveDocumentMeta: (nextFolderId?: string | null) => void;
  deleteDocument: () => void;
  reorderDocument: (direction: "up" | "down") => void;
  toggleFolder: (folderId: string) => void;
  renameFolder: (folder: DocumentFolderRecord, title: string) => void;
  deleteFolder: (folderId: string) => void;
};

export function useDocumentActions(input: UseDocumentActionsInput): DocumentActions {
  const { workspaceHook: { runMutation, workspaceRef }, activeProject, activeDocument, drafts, setDrafts } = input;
  const currentWorkspace = (): WorkspaceState | null => workspaceRef.current;

  const createFolder = useCallback((titleOverride?: string) => {
    if (!activeProject) return;
    const ws = currentWorkspace();
    const title = titleOverride?.trim() || drafts.newFolderTitle.trim() || `Folder ${countForLabel(ws?.folders.length ?? 0)}`;
    setDrafts.setNewFolderTitle("");
    void runMutation(
      () => window.evernear.createFolder({ projectId: activeProject.id, title }),
      `Created folder "${title}".`,
    );
  }, [runMutation, activeProject, drafts.newFolderTitle, setDrafts, workspaceRef]);

  const createDocument = useCallback((folderId: string | null, openInPanel = false, titleOverride?: string) => {
    if (!activeProject) return;
    const ws = currentWorkspace();
    const title = titleOverride?.trim() || drafts.newDocumentTitle.trim() || `Document ${countForLabel(ws?.documents.length ?? 0)}`;
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
      "Deleted the folder and moved its documents to Unfiled.",
    );
  }, [runMutation]);

  return {
    createFolder, createDocument, openDocument, saveDocumentMeta,
    deleteDocument, reorderDocument, toggleFolder, renameFolder, deleteFolder,
  };
}
