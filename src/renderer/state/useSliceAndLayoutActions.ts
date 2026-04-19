// Small dispatch table for the leftover actions that don't belong to a
// single aggregate: slice mutations, panel surface toggles, and the
// global highlight toggle. Folded together because each one is a one-
// or two-line IPC wrapper; splitting further would just be ceremony.

import { useCallback } from "react";

import type { WorkspaceState } from "../../shared/domain/workspace";
import type { WorkspaceHook } from "./useWorkspace";

type UseSliceAndLayoutActionsInput = {
  workspaceHook: WorkspaceHook;
};

export type SliceAndLayoutActions = {
  toggleHighlights: () => void;
  togglePanel: () => void;
  deleteSlice: (sliceId: string) => void;
  openSliceInPanel: (documentId: string, entityId: string) => void;
  closePanelDocument: () => void;
};

export function useSliceAndLayoutActions(input: UseSliceAndLayoutActionsInput): SliceAndLayoutActions {
  const { workspaceHook: { runMutation, applyWorkspace, workspaceRef } } = input;
  const currentWorkspace = (): WorkspaceState | null => workspaceRef.current;

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

  return { toggleHighlights, togglePanel, deleteSlice, openSliceInPanel, closePanelDocument };
}
