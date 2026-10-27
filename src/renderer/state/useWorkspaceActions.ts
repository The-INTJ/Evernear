// Composition facade over the four per-aggregate action hooks. Kept so
// App.tsx doesn't need to know about the split — it consumes a single
// `actions` object.

import type {
  DocumentFolderRecord,
  DocumentSummary,
  MatchingRuleInput,
  ProjectRecord,
} from "../../shared/domain/workspace";
import type { StoredDocumentSnapshot } from "../../shared/domain/document";
import type { WorkspaceHook } from "./useWorkspace";
import { useProjectActions } from "./useProjectActions";
import { useDocumentActions } from "./useDocumentActions";
import { useEntityActions } from "./useEntityActions";
import { useSliceAndLayoutActions } from "./useSliceAndLayoutActions";

type UseWorkspaceActionsInput = {
  workspaceHook: WorkspaceHook;
  activeProject: ProjectRecord | null;
  activeDocument: StoredDocumentSnapshot | null;
  drafts: {
    projectNameDraft: string;
    documentTitleDraft: string;
    newFolderTitle: string;
    newDocumentTitle: string;
  };
  setDrafts: {
    setNewFolderTitle: React.Dispatch<React.SetStateAction<string>>;
    setNewDocumentTitle: React.Dispatch<React.SetStateAction<string>>;
  };
};

export type WorkspaceActions = {
  switchProject: (projectId: string) => void;
  createProject: () => void;
  saveProjectName: () => void;
  createFolder: (parentFolderId?: string | null, titleOverride?: string) => void;
  createDocument: (folderId: string | null, openInPanel?: boolean, titleOverride?: string) => void;
  openDocument: (documentId: string) => void;
  saveDocumentMeta: (nextFolderId?: string | null) => void;
  deleteDocument: () => void;
  deleteDocumentById: (documentId: string, title: string) => void;
  renameDocument: (document: DocumentSummary, title: string) => void;
  reorderDocument: (direction: "up" | "down") => void;
  moveDocument: (documentId: string, newFolderId: string | null, beforeDocumentId: string | null) => void;
  toggleFolder: (folderId: string) => void;
  renameFolder: (folder: DocumentFolderRecord, title: string) => void;
  deleteFolder: (folderId: string) => void;
  moveFolder: (folderId: string, newParentFolderId: string | null, beforeFolderId: string | null) => void;
  toggleHighlights: () => void;
  toggleSlices: () => void;
  createEntityFromText: (text: string) => void;
  saveEntity: (entityId: string, name: string, rules: MatchingRuleInput[]) => Promise<boolean>;
  deleteEntity: (entityId: string) => void;
  deleteSlice: (sliceId: string) => void;
};

export function useWorkspaceActions(input: UseWorkspaceActionsInput): WorkspaceActions {
  const project = useProjectActions({
    workspaceHook: input.workspaceHook,
    activeProject: input.activeProject,
    projectNameDraft: input.drafts.projectNameDraft,
  });

  const document = useDocumentActions({
    workspaceHook: input.workspaceHook,
    activeProject: input.activeProject,
    activeDocument: input.activeDocument,
    drafts: {
      documentTitleDraft: input.drafts.documentTitleDraft,
      newFolderTitle: input.drafts.newFolderTitle,
      newDocumentTitle: input.drafts.newDocumentTitle,
    },
    setDrafts: input.setDrafts,
  });

  const entity = useEntityActions({
    workspaceHook: input.workspaceHook,
    activeProject: input.activeProject,
  });

  const sliceAndLayout = useSliceAndLayoutActions({ workspaceHook: input.workspaceHook });

  return { ...project, ...document, ...entity, ...sliceAndLayout };
}
