// Edit slices mode, in the main editor. Opening a slice from the hover
// preview switches to its document, scrolls to it and turns editing on,
// remembering where the author was writing; Done goes back there. Turning
// editing on from the toolbar stays in the current document. The editor
// remounts per document, so reveals wait until the active document matches.

import { useCallback, useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";

import type { HarnessEditorHandle } from "../editor/HarnessEditor";
import type { WorkspaceHook } from "./useWorkspace";
import type { WorkspaceLookups } from "./useWorkspaceLookups";

type ReturnPoint = {
  documentId: string;
  scrollTop: number;
};

type PendingReveal =
  | { documentId: string; sliceId: string }
  | { documentId: string; scrollTop: number };

type UseSliceEditingInput = {
  workspaceHook: WorkspaceHook;
  lookups: WorkspaceLookups;
  editorRef: MutableRefObject<HarnessEditorHandle | null>;
};

export type SliceEditing = {
  editing: boolean;
  focusedSliceId: string | null;
  focusSlice: (sliceId: string | null) => void;
  toggleEditing: () => void;
  openSlice: (sliceId: string) => void;
  finishEditing: () => void;
};

export function useSliceEditing(input: UseSliceEditingInput): SliceEditing {
  const { workspaceHook, lookups, editorRef } = input;
  const { workspace, workspaceRef, runMutation, flushPersistence, notify } = workspaceHook;
  const [editing, setEditing] = useState(false);
  const [focusedSliceId, setFocusedSliceId] = useState<string | null>(null);
  const [pendingReveal, setPendingReveal] = useState<PendingReveal | null>(null);
  const returnPointRef = useRef<ReturnPoint | null>(null);

  const showDocument = useCallback(async (documentId: string) => {
    if (workspaceRef.current?.activeDocument?.id === documentId) {
      await flushPersistence();
    } else {
      await runMutation(() => window.evernear.openDocument({ documentId, surface: "main" }));
    }
  }, [workspaceRef, flushPersistence, runMutation]);

  const openSlice = useCallback((sliceId: string) => {
    const slice = lookups.slicesById.get(sliceId);
    if (!slice) return;
    const current = workspaceRef.current?.activeDocument;
    if (!editing && current) {
      returnPointRef.current = { documentId: current.id, scrollTop: editorRef.current?.getScrollTop() ?? 0 };
    }
    setEditing(true);
    setFocusedSliceId(sliceId);
    void showDocument(slice.documentId).then(() => setPendingReveal({ documentId: slice.documentId, sliceId }));
  }, [lookups.slicesById, workspaceRef, editing, editorRef, showDocument]);

  const finishEditing = useCallback(() => {
    setEditing(false);
    setFocusedSliceId(null);
    const back = returnPointRef.current;
    returnPointRef.current = null;
    if (!back) return;
    void showDocument(back.documentId).then(() => setPendingReveal(back));
  }, [showDocument]);

  const toggleEditing = useCallback(() => {
    if (editing) {
      finishEditing();
      return;
    }
    returnPointRef.current = null;
    setFocusedSliceId(null);
    setEditing(true);
  }, [editing, finishEditing]);

  const activeDocumentId = workspace?.activeDocument?.id ?? null;
  useEffect(() => {
    if (!pendingReveal || pendingReveal.documentId !== activeDocumentId) return;
    setPendingReveal(null);

    if ("scrollTop" in pendingReveal) {
      editorRef.current?.setScrollTop(pendingReveal.scrollTop);
      return;
    }
    const resolution = lookups.boundariesBySliceId.get(pendingReveal.sliceId)?.resolution;
    if (!resolution || resolution.status === "invalid" || resolution.status === "ambiguous") {
      notify("This slice's text can't be found. Select the text it should cover and press Place.", "warn");
      return;
    }
    editorRef.current?.scrollToPosition(resolution.anchor.from);
  }, [pendingReveal, activeDocumentId, lookups.boundariesBySliceId, editorRef, notify]);

  // A focused slice that was removed shouldn't keep the bar's actions.
  useEffect(() => {
    if (focusedSliceId && !lookups.slicesById.has(focusedSliceId)) {
      setFocusedSliceId(null);
    }
  }, [focusedSliceId, lookups.slicesById]);

  return {
    editing,
    focusedSliceId,
    focusSlice: setFocusedSliceId,
    toggleEditing,
    openSlice,
    finishEditing,
  };
}
