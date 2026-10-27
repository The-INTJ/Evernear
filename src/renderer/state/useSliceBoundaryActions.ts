// Saving what the author does in Edit slices: a dragged handle, or placing
// a lost slice on the current selection. Both re-anchor through the same
// rule as Add slice (sliceCommit.ts): flush saves first, then build the
// anchor from the editor's own snapshot so positions and text agree.

import { useCallback } from "react";
import type { MutableRefObject } from "react";

import type { HarnessEditorHandle } from "../editor/HarnessEditor";
import { buildTextAnchorFromSelection } from "../editor/editorUtils";
import { stringifyError } from "../utils/formatting";
import { resolveAnchorSnapshot } from "./sliceCommit";
import type { WorkspaceHook } from "./useWorkspace";
import type { WorkspaceLookups } from "./useWorkspaceLookups";

type UseSliceBoundaryActionsInput = {
  workspaceHook: WorkspaceHook;
  lookups: WorkspaceLookups;
  editorRef: MutableRefObject<HarnessEditorHandle | null>;
};

export type SliceBoundaryActions = {
  moveBoundary: (sliceId: string, from: number, to: number) => void;
  placeSlice: (sliceId: string) => void;
};

export function useSliceBoundaryActions(input: UseSliceBoundaryActionsInput): SliceBoundaryActions {
  const { workspaceHook, lookups, editorRef } = input;
  const { workspaceRef, flushPersistence, applyWorkspace, notify } = workspaceHook;

  const saveBoundary = useCallback(async (sliceId: string, from: number, to: number) => {
    const boundary = lookups.boundariesBySliceId.get(sliceId);
    const editor = editorRef.current;
    if (!boundary || !editor) return;

    try {
      await flushPersistence();
      const workspace = workspaceRef.current;
      const activeDocument = workspace?.activeDocument;
      if (!workspace || !activeDocument || activeDocument.id !== boundary.documentId) {
        throw new Error("Open the slice's document before changing it.");
      }

      const anchor = buildTextAnchorFromSelection(resolveAnchorSnapshot(editor, activeDocument), {
        from,
        to,
        empty: false,
        text: "",
      });
      if (!anchor) throw new Error("A slice needs at least one character.");

      const updated = await window.evernear.updateSliceBoundary({ boundaryId: boundary.id, anchor });
      const latest = workspaceRef.current ?? workspace;
      applyWorkspace({
        ...latest,
        sliceBoundaries: latest.sliceBoundaries.map((candidate) => (candidate.id === updated.id ? updated : candidate)),
      });
    } catch (error) {
      notify(`The slice wasn't changed: ${stringifyError(error)}`, "warn");
    }
  }, [lookups.boundariesBySliceId, editorRef, flushPersistence, workspaceRef, applyWorkspace, notify]);

  const moveBoundary = useCallback((sliceId: string, from: number, to: number) => {
    void saveBoundary(sliceId, from, to);
  }, [saveBoundary]);

  const placeSlice = useCallback((sliceId: string) => {
    const selection = editorRef.current?.getSelection();
    if (!selection || selection.empty) {
      notify("Select the text this slice should cover, then press Place.", "warn");
      return;
    }
    void saveBoundary(sliceId, selection.from, selection.to);
  }, [editorRef, notify, saveBoundary]);

  return { moveBoundary, placeSlice };
}
