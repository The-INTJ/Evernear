// Small dispatch table for the actions that don't belong to a single
// aggregate: the two highlight toggles and slice deletion. Each is a one-
// or two-line IPC wrapper; splitting further would just be ceremony.

import { useCallback } from "react";

import type { WorkspaceState } from "../../shared/domain/workspace";
import type { WorkspaceHook } from "./useWorkspace";

type UseSliceAndLayoutActionsInput = {
  workspaceHook: WorkspaceHook;
};

export type SliceAndLayoutActions = {
  toggleHighlights: () => void;
  toggleSlices: () => void;
  deleteSlice: (sliceId: string) => void;
};

export function useSliceAndLayoutActions(input: UseSliceAndLayoutActionsInput): SliceAndLayoutActions {
  const { workspaceHook: { runMutation, workspaceRef } } = input;
  const currentWorkspace = (): WorkspaceState | null => workspaceRef.current;

  const toggleHighlights = useCallback(() => {
    const ws = currentWorkspace();
    if (!ws) return;
    void runMutation(() => window.evernear.updateLayout({ highlightsEnabled: !ws.layout.highlightsEnabled }));
  }, [runMutation, workspaceRef]);

  const toggleSlices = useCallback(() => {
    const ws = currentWorkspace();
    if (!ws) return;
    void runMutation(() => window.evernear.updateLayout({ slicesVisible: !ws.layout.slicesVisible }));
  }, [runMutation, workspaceRef]);

  const deleteSlice = useCallback((sliceId: string) => {
    void runMutation(() => window.evernear.deleteSlice({ sliceId }));
  }, [runMutation]);

  return { toggleHighlights, toggleSlices, deleteSlice };
}
