// Owns the placement half of the FB-001 flow: the in-editor pending range
// the author drags or clicks into to commit a slice. The session-side
// orchestration (entity creation, rule upsert, target document creation)
// lives in useEverlinkSession.resolveSessionTargets — this hook receives
// the already-resolved IDs and just drives the editor surface.
//
// This hook holds the editor refs and is responsible for commit-time
// re-anchoring. PR 5 (Tier 1.4) tightens that re-anchoring; the current
// commit body is the pre-fix version preserved verbatim from the original
// useEverlinkPlacement so this PR stays a no-behavior-change extraction.

import { useCallback, useMemo, useRef, useState } from "react";

import type {
  HarnessEditorHandle,
  PendingSliceRange,
} from "../editor/HarnessEditor";
import {
  buildTextAnchorFromSelection,
  type EditorSelectionInfo,
} from "../editor/workbenchUtils";
import { stringifyError, truncate } from "../utils/formatting";
import type {
  EverlinkSession,
  PendingSlicePlacement,
} from "./sessionTypes";
import type { WorkspaceHook } from "./useWorkspace";
import type { EditorSelectionsHook, SelectionSurface } from "./useEditorSelections";
import type { ResolvedSessionTargets } from "./useEverlinkSession";

export type PendingPlacementHook = {
  placement: PendingSlicePlacement | null;
  mainPendingRange: PendingSliceRange | null;
  panelPendingRange: PendingSliceRange | null;
  beginPlacement: (session: EverlinkSession, resolved: ResolvedSessionTargets) => Promise<void>;
  commitPendingSlice: () => Promise<void>;
  resetPlacement: () => void;
  handleSelectionChange: (surface: SelectionSurface, selection: EditorSelectionInfo) => void;
  handleMainBlur: () => Promise<void>;
  handlePanelBlur: () => Promise<void>;
};

type UsePendingPlacementInput = {
  workspaceHook: WorkspaceHook;
  selections: EditorSelectionsHook;
  editorRefs: {
    main: React.MutableRefObject<HarnessEditorHandle | null>;
    panel: React.MutableRefObject<HarnessEditorHandle | null>;
  };
};

export function usePendingPlacement(input: UsePendingPlacementInput): PendingPlacementHook {
  const { workspaceHook, selections, editorRefs } = input;
  const { workspace, applyWorkspace, appendLog, flushPersistence, setBusy, commitInFlightRef } = workspaceHook;
  const { mainSelection, panelSelection, setSelection } = selections;

  const [placement, setPlacement] = useState<PendingSlicePlacement | null>(null);
  const placementRef = useRef<PendingSlicePlacement | null>(null);
  placementRef.current = placement;

  const mainPendingRange = useMemo<PendingSliceRange | null>(() => {
    if (!placement || placement.surface !== "main") return null;
    const { start, end } = placement;
    if (start === null || end === null) return null;
    return { from: start, to: end, awaitingPlacement: start === end };
  }, [placement]);

  const panelPendingRange = useMemo<PendingSliceRange | null>(() => {
    if (!placement || placement.surface !== "panel") return null;
    const { start, end } = placement;
    if (start === null || end === null) return null;
    return { from: start, to: end, awaitingPlacement: start === end };
  }, [placement]);

  const handleSelectionChange = useCallback((surface: SelectionSurface, selection: EditorSelectionInfo) => {
    setSelection(surface, selection);
    setPlacement((current) => {
      if (!current || current.surface !== surface) {
        return current;
      }
      // Track the live selection/cursor so the user can freely type, paste,
      // or select in the target doc. The pending range always reflects the
      // current selection — an empty cursor at commit triggers source-text
      // insertion; a non-empty selection is used verbatim as the slice.
      return {
        ...current,
        start: selection.from,
        end: selection.empty ? selection.from : selection.to,
      };
    });
  }, [setSelection]);

  const beginPlacement = useCallback(async (session: EverlinkSession, resolved: ResolvedSessionTargets) => {
    const { entityId, targetDocumentId, surface, sourceText } = resolved;
    const nextWorkspace = surface === "panel"
      ? await window.evernear.openDocument({ documentId: targetDocumentId, surface: "panel" })
      : await window.evernear.updateLayout({
          panelOpen: true,
          panelMode: "placement",
          panelDocumentId: null,
          selectedEntityId: entityId,
        });
    applyWorkspace(nextWorkspace, "Started slice placement.");

    setPlacement({
      entityId,
      sourceDocumentId: session.sourceDocumentId,
      sourceText,
      targetDocumentId,
      surface,
      start: null,
      end: null,
    });
  }, [applyWorkspace]);

  const commitPendingSlice = useCallback(async () => {
    const current = placementRef.current;
    if (!workspace || !current) return;
    const activeProject = workspace.projects.find((project) => project.id === workspace.layout.activeProjectId) ?? null;
    if (!activeProject) return;
    if (commitInFlightRef.current) return;

    const editor = current.surface === "main" ? editorRefs.main.current : editorRefs.panel.current;
    if (!editor) {
      appendLog("The slice placement surface is not ready yet.", "warn");
      return;
    }

    let start = current.start;
    let end = current.end;
    if (start === null || end === null) {
      const selection = current.surface === "main" ? mainSelection : panelSelection;
      start = selection.from;
      end = selection.empty ? selection.from : selection.to;
    }

    if (start === null || end === null) {
      appendLog("Click or select inside the target document before committing the slice.", "warn");
      return;
    }

    if (start === end) {
      const insertedRange = editor.replaceSelection(current.sourceText);
      if (!insertedRange) {
        appendLog("Could not auto-fill the empty pending slice.", "warn");
        return;
      }
      start = insertedRange.from;
      end = insertedRange.to;
    }

    setBusy(true);
    commitInFlightRef.current = true;

    try {
      await flushPersistence();
      const refreshed = await window.evernear.loadWorkspace();
      applyWorkspace(refreshed);

      const targetSnapshot = refreshed.activeDocument?.id === current.targetDocumentId
        ? refreshed.activeDocument
        : refreshed.panelDocument?.id === current.targetDocumentId
          ? refreshed.panelDocument
          : null;

      if (!targetSnapshot) {
        throw new Error("Could not load the target document after slice placement.");
      }

      const anchor = buildTextAnchorFromSelection(targetSnapshot, {
        from: Math.min(start, end),
        to: Math.max(start, end),
        empty: false,
        text: current.sourceText,
      });

      if (!anchor) {
        throw new Error("Could not build an anchored slice range from the committed placement.");
      }

      const nextWorkspace = await window.evernear.createSlice({
        projectId: activeProject.id,
        entityId: current.entityId,
        documentId: current.targetDocumentId,
        title: truncate(current.sourceText.trim(), 42),
        anchor,
      });
      applyWorkspace(nextWorkspace, "Committed the slice and linked it to the selected entity.");
      setPlacement(null);
    } catch (error) {
      appendLog(`Slice placement failed: ${stringifyError(error)}`, "warn");
    } finally {
      commitInFlightRef.current = false;
      setBusy(false);
    }
  }, [workspace, mainSelection, panelSelection, editorRefs, appendLog, applyWorkspace, flushPersistence, setBusy, commitInFlightRef]);

  const resetPlacement = useCallback(() => {
    setPlacement(null);
  }, []);

  // Blur is intentionally a no-op: the live placement follows the cursor,
  // so an idle cursor after typing would otherwise trigger a surprise commit
  // every time the author clicked away. Commit is always explicit.
  const handleMainBlur = useCallback(async () => {}, []);
  const handlePanelBlur = useCallback(async () => {}, []);

  return {
    placement,
    mainPendingRange,
    panelPendingRange,
    beginPlacement,
    commitPendingSlice,
    resetPlacement,
    handleSelectionChange,
    handleMainBlur,
    handlePanelBlur,
  };
}
