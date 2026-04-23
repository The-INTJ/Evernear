import { useCallback, useState } from "react";
import type { MutableRefObject } from "react";

import type { StoredDocumentSnapshot } from "../../shared/domain/document";
import type { WorkspaceState } from "../../shared/domain/workspace";
import type { EditorContextMenuPayload, HarnessEditorHandle } from "../editor/HarnessEditor";
import type { EditorSelectionInfo } from "../editor/editorUtils";
import { selectedSlicesForEntity } from "../utils/workspace";
import type { WorkspaceActions } from "./useWorkspaceActions";
import type { WorkspaceLookups } from "./useWorkspaceLookups";
import type { EditorSelectionsHook } from "./useEditorSelections";

type UseEditorCommandActionsInput = {
  mainEditorRef: MutableRefObject<HarnessEditorHandle | null>;
  selections: EditorSelectionsHook;
  workspace: WorkspaceState | null;
  activeDocument: StoredDocumentSnapshot | null;
  lookups: WorkspaceLookups;
  actions: WorkspaceActions;
  openEverlink: () => Promise<void>;
  openEverslice: () => void;
  handleSelectionChange: (selection: EditorSelectionInfo) => void;
  clearHoverState: () => void;
};

export type EditorCommandActions = {
  editorContextMenu: EditorContextMenuPayload | null;
  closeEditorContextMenu: () => void;
  toggleBold: () => void;
  toggleItalic: () => void;
  undo: () => void;
  redo: () => void;
  openEverlink: () => void;
  openEverslice: () => void;
  selectAll: () => void;
  copySelection: () => void;
  openEntityContext: (entityId: string) => void;
  selectEntityFromMenu: (entityId: string) => void;
  toggleHighlightsFromMenu: () => void;
  handleEditorContextMenu: (payload: EditorContextMenuPayload) => void;
  handleMainSelectionChange: (selection: EditorSelectionInfo) => void;
};

export function useEditorCommandActions(input: UseEditorCommandActionsInput): EditorCommandActions {
  const {
    mainEditorRef,
    selections,
    workspace,
    activeDocument,
    lookups,
    actions,
    openEverlink,
    openEverslice,
    handleSelectionChange,
    clearHoverState,
  } = input;
  const [editorContextMenu, setEditorContextMenu] = useState<EditorContextMenuPayload | null>(null);

  const closeEditorContextMenu = useCallback(() => {
    setEditorContextMenu(null);
  }, []);

  const runEditorCommand = useCallback((command: (editor: HarnessEditorHandle) => void) => {
    const editor = mainEditorRef.current;
    if (!editor) return;
    command(editor);
    closeEditorContextMenu();
  }, [mainEditorRef, closeEditorContextMenu]);

  const handleOpenEverlink = useCallback(() => {
    closeEditorContextMenu();
    void openEverlink();
  }, [closeEditorContextMenu, openEverlink]);

  const handleOpenEverslice = useCallback(() => {
    closeEditorContextMenu();
    openEverslice();
  }, [closeEditorContextMenu, openEverslice]);

  const copySelection = useCallback(() => {
    const text = editorContextMenu?.selection.text || selections.mainSelection.text;
    if (text.length > 0 && navigator.clipboard) {
      void navigator.clipboard.writeText(text);
    }
    closeEditorContextMenu();
  }, [closeEditorContextMenu, editorContextMenu?.selection.text, selections.mainSelection.text]);

  const openEntityContext = useCallback((entityId: string) => {
    const slices = selectedSlicesForEntity(
      entityId,
      workspace,
      lookups.slicesById,
      lookups.boundariesBySliceId,
      lookups.documentsById,
    );
    const firstSlice = slices[0];
    const targetDocumentId = firstSlice?.boundary?.documentId
      ?? firstSlice?.document?.id
      ?? activeDocument?.id
      ?? null;

    if (targetDocumentId) {
      actions.openSliceInPanel(targetDocumentId, entityId);
    } else {
      actions.selectEntity(entityId);
    }
    clearHoverState();
    closeEditorContextMenu();
  }, [workspace, lookups, activeDocument, actions, clearHoverState, closeEditorContextMenu]);

  const selectEntityFromMenu = useCallback((entityId: string) => {
    actions.selectEntity(entityId);
    closeEditorContextMenu();
  }, [actions, closeEditorContextMenu]);

  const toggleHighlightsFromMenu = useCallback(() => {
    actions.toggleHighlights();
    closeEditorContextMenu();
  }, [actions, closeEditorContextMenu]);

  const handleEditorContextMenu = useCallback((payload: EditorContextMenuPayload) => {
    clearHoverState();
    setEditorContextMenu(payload);
  }, [clearHoverState]);

  const handleMainSelectionChange = useCallback((selection: EditorSelectionInfo) => {
    handleSelectionChange(selection);
    if (selection.empty) closeEditorContextMenu();
  }, [handleSelectionChange, closeEditorContextMenu]);

  return {
    editorContextMenu,
    closeEditorContextMenu,
    toggleBold: () => runEditorCommand((editor) => editor.toggleBold()),
    toggleItalic: () => runEditorCommand((editor) => editor.toggleItalic()),
    undo: () => runEditorCommand((editor) => editor.undo()),
    redo: () => runEditorCommand((editor) => editor.redo()),
    openEverlink: handleOpenEverlink,
    openEverslice: handleOpenEverslice,
    selectAll: () => runEditorCommand((editor) => editor.selectAll()),
    copySelection,
    openEntityContext,
    selectEntityFromMenu,
    toggleHighlightsFromMenu,
    handleEditorContextMenu,
    handleMainSelectionChange,
  };
}
