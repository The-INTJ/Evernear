// Composition facade over useEverlinkSession + usePendingPlacement.
//
// History: this file used to own both halves of the FB-001 flow inline,
// pushing it past the 250-line hard cap and (per AGENT.md R7) blocking
// FB-002 Everslice — which must not merge into useEverlinkPlacement. The
// April 2026 split moved the session half into useEverlinkSession and the
// placement half into usePendingPlacement; this file became the orchestrator
// that wires them together and preserves the public surface App.tsx
// already consumes.
//
// What lives here vs. the per-half hooks:
//   - Session-only state + actions       → useEverlinkSession
//   - Placement-only state + actions     → usePendingPlacement
//   - Cross-hook orchestration:          → here
//       * beginPlacement: read session → drive placement → clear session
//       * cancelFlow:     reset both halves and the layout panel mode

import { useCallback } from "react";

import type {
  HarnessEditorHandle,
  PendingSliceRange,
} from "../editor/HarnessEditor";
import type { EditorSelectionInfo } from "../editor/workbenchUtils";
import type {
  EverlinkSession,
  PendingSlicePlacement,
} from "./sessionTypes";
import type { WorkspaceHook } from "./useWorkspace";
import type { WorkspaceLookups } from "./useWorkspaceLookups";
import type { EditorSelectionsHook, SelectionSurface } from "./useEditorSelections";
import { useEverlinkSession } from "./useEverlinkSession";
import { usePendingPlacement } from "./usePendingPlacement";

export type EverlinkPlacementHook = {
  everlinkSession: EverlinkSession | null;
  pendingPlacement: PendingSlicePlacement | null;
  mainPendingRange: PendingSliceRange | null;
  panelPendingRange: PendingSliceRange | null;
  exactSelectionEntityIds: string[];
  setSession: React.Dispatch<React.SetStateAction<EverlinkSession | null>>;
  openChooser: () => Promise<void>;
  beginPlacement: () => Promise<void>;
  createTargetDocumentFromChooser: () => Promise<void>;
  commitPendingSlice: () => Promise<void>;
  cancelFlow: () => Promise<void>;
  handleSelectionChange: (surface: SelectionSurface, selection: EditorSelectionInfo) => void;
  handleMainBlur: () => Promise<void>;
  handlePanelBlur: () => Promise<void>;
};

type UseEverlinkPlacementInput = {
  workspaceHook: WorkspaceHook;
  selections: EditorSelectionsHook;
  lookups: WorkspaceLookups;
  editorRefs: {
    main: React.MutableRefObject<HarnessEditorHandle | null>;
    panel: React.MutableRefObject<HarnessEditorHandle | null>;
  };
};

export function useEverlinkPlacement(input: UseEverlinkPlacementInput): EverlinkPlacementHook {
  const { workspaceHook, selections, lookups, editorRefs } = input;
  const { workspace, runMutation } = workspaceHook;

  const sessionHook = useEverlinkSession({ workspaceHook, selections, lookups });
  const placementHook = usePendingPlacement({ workspaceHook, selections, editorRefs });

  const beginPlacement = useCallback(async () => {
    if (!sessionHook.session) return;
    const resolved = await sessionHook.resolveSessionTargets(sessionHook.session);
    if (!resolved) return;
    await placementHook.beginPlacement(sessionHook.session, resolved);
    sessionHook.resetSession();
  }, [sessionHook, placementHook]);

  const cancelFlow = useCallback(async () => {
    placementHook.resetPlacement();
    sessionHook.resetSession();
    if (workspace) {
      await runMutation(() => window.evernear.updateLayout({ panelMode: "entities" }));
    }
  }, [workspace, runMutation, sessionHook, placementHook]);

  return {
    everlinkSession: sessionHook.session,
    pendingPlacement: placementHook.placement,
    mainPendingRange: placementHook.mainPendingRange,
    panelPendingRange: placementHook.panelPendingRange,
    exactSelectionEntityIds: sessionHook.exactSelectionEntityIds,
    setSession: sessionHook.setSession,
    openChooser: sessionHook.openChooser,
    beginPlacement,
    createTargetDocumentFromChooser: sessionHook.createTargetDocumentFromChooser,
    commitPendingSlice: placementHook.commitPendingSlice,
    cancelFlow,
    handleSelectionChange: placementHook.handleSelectionChange,
    handleMainBlur: placementHook.handleMainBlur,
    handlePanelBlur: placementHook.handlePanelBlur,
  };
}
