// Opens a slice where it lives: switches the main editor to the slice's
// document when needed, then selects the slice's text once that document
// is on screen. The editor remounts per document, so the reveal waits for
// the active document to match before touching the editor.

import { useCallback, useEffect, useState } from "react";
import type { MutableRefObject } from "react";

import type { HarnessEditorHandle } from "../editor/HarnessEditor";
import type { WorkspaceHook } from "./useWorkspace";
import type { WorkspaceLookups } from "./useWorkspaceLookups";

type PendingReveal = {
  documentId: string;
  sliceId: string;
};

type UseSliceNavigationInput = {
  workspaceHook: WorkspaceHook;
  lookups: WorkspaceLookups;
  editorRef: MutableRefObject<HarnessEditorHandle | null>;
};

export type SliceNavigation = {
  openSlice: (sliceId: string) => void;
};

export function useSliceNavigation(input: UseSliceNavigationInput): SliceNavigation {
  const { workspaceHook, lookups, editorRef } = input;
  const { workspace, workspaceRef, runMutation, flushPersistence, notify } = workspaceHook;
  const [pendingReveal, setPendingReveal] = useState<PendingReveal | null>(null);

  const openSlice = useCallback((sliceId: string) => {
    const slice = lookups.slicesById.get(sliceId);
    if (!slice) return;
    void (async () => {
      if (workspaceRef.current?.activeDocument?.id === slice.documentId) {
        await flushPersistence();
      } else {
        await runMutation(() => window.evernear.openDocument({ documentId: slice.documentId, surface: "main" }));
      }
      setPendingReveal({ documentId: slice.documentId, sliceId });
    })();
  }, [lookups.slicesById, workspaceRef, flushPersistence, runMutation]);

  const activeDocumentId = workspace?.activeDocument?.id ?? null;
  useEffect(() => {
    if (!pendingReveal || pendingReveal.documentId !== activeDocumentId) return;
    setPendingReveal(null);

    const resolution = lookups.boundariesBySliceId.get(pendingReveal.sliceId)?.resolution;
    if (!resolution || resolution.status === "invalid" || resolution.status === "ambiguous") {
      notify("This slice's text can't be found in its document anymore.", "warn");
      return;
    }
    editorRef.current?.revealRange(resolution.anchor.from, resolution.anchor.to);
  }, [pendingReveal, activeDocumentId, lookups.boundariesBySliceId, editorRef, notify]);

  return { openSlice };
}
