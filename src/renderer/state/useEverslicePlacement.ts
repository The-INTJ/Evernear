// Owns the Everslice flow: the author selects a passage in the current
// document and wants to bind it to an entity without leaving the page.
// Freezes the selection at open() time so the author can type/click inside
// the modal without losing the range, then commits on confirm using the
// shared re-anchoring helper. `targetDocumentId === sourceDocumentId` is
// the only structural difference from Everlink's cross-doc flow.
//
// Kept separate from useEverlinkPlacement per R7 and FB-002's risk note:
// the symmetry is visual, not structural. Merging would push the Everlink
// facade past the 250-line hook cap and couple two flows whose rules
// (no target-doc routing, no matching-rule authoring, no pending-range
// drag) diverge at the session layer.

import { useCallback, useMemo, useState } from "react";
import type { MutableRefObject } from "react";

import type {
  HarnessEditorHandle,
  PendingSliceRange,
} from "../editor/HarnessEditor";
import type { EditorSelectionInfo } from "../editor/editorUtils";
import { stringifyError } from "../utils/formatting";
import { commitSliceWithFreshAnchor } from "./everlinkShared";
import type { WorkspaceHook } from "./useWorkspace";
import type { EditorSelectionsHook } from "./useEditorSelections";

type FrozenSelection = {
  selection: EditorSelectionInfo;
  sourceDocumentId: string;
};

export type EverslicePlacementHook = {
  isOpen: boolean;
  sourceText: string;
  sourceDocumentId: string | null;
  frozenPendingRange: PendingSliceRange | null;
  open: () => void;
  close: () => void;
  confirmExisting: (entityId: string) => Promise<void>;
  confirmNew: (entityName: string) => Promise<void>;
};

type UseEverslicePlacementInput = {
  workspaceHook: WorkspaceHook;
  selections: EditorSelectionsHook;
  editorRef: MutableRefObject<HarnessEditorHandle | null>;
};

export function useEverslicePlacement(input: UseEverslicePlacementInput): EverslicePlacementHook {
  const { workspaceHook, selections, editorRef } = input;
  const {
    applyWorkspace,
    appendLog,
    flushPersistence,
    setBusy,
    workspaceRef,
    commitInFlightRef,
  } = workspaceHook;
  const { mainSelection } = selections;

  const [frozen, setFrozen] = useState<FrozenSelection | null>(null);

  const frozenPendingRange = useMemo<PendingSliceRange | null>(() => {
    if (!frozen || frozen.selection.empty) return null;
    return {
      from: frozen.selection.from,
      to: frozen.selection.to,
      awaitingPlacement: false,
    };
  }, [frozen]);

  const open = useCallback(() => {
    const workspace = workspaceRef.current;
    const activeDocument = workspace?.activeDocument ?? null;
    if (!activeDocument) {
      appendLog("Open a document before using Everslice it!.", "warn");
      return;
    }
    if (mainSelection.empty || mainSelection.text.trim().length === 0) {
      appendLog("Select some text before using Everslice it!.", "warn");
      return;
    }
    setFrozen({
      selection: mainSelection,
      sourceDocumentId: activeDocument.id,
    });
  }, [workspaceRef, mainSelection, appendLog]);

  const close = useCallback(() => {
    setFrozen(null);
  }, []);

  const runCommit = useCallback(async (entityId: string, currentFrozen: FrozenSelection): Promise<void> => {
    const editor = editorRef.current;
    if (!editor) {
      appendLog("The Everslice editor surface is not ready yet.", "warn");
      return;
    }
    const workspace = workspaceRef.current;
    const activeProject = workspace?.projects.find(
      (project) => project.id === workspace.layout.activeProjectId,
    ) ?? null;
    if (!activeProject) {
      appendLog("Could not resolve the active project for Everslice.", "warn");
      return;
    }

    const committed = await commitSliceWithFreshAnchor({
      editor,
      projectId: activeProject.id,
      entityId,
      targetDocumentId: currentFrozen.sourceDocumentId,
      sourceText: currentFrozen.selection.text,
      start: currentFrozen.selection.from,
      end: currentFrozen.selection.to,
      workspaceRef,
      flushPersistence,
      applyWorkspace,
      appendLog,
      setBusy,
      commitInFlightRef,
    });

    if (committed) {
      setFrozen(null);
    }
  }, [editorRef, workspaceRef, flushPersistence, applyWorkspace, appendLog, setBusy, commitInFlightRef]);

  const confirmExisting = useCallback(async (entityId: string): Promise<void> => {
    if (!frozen) return;
    await runCommit(entityId, frozen);
  }, [frozen, runCommit]);

  const confirmNew = useCallback(async (entityName: string): Promise<void> => {
    if (!frozen) return;
    const workspace = workspaceRef.current;
    const activeProject = workspace?.projects.find(
      (project) => project.id === workspace.layout.activeProjectId,
    ) ?? null;
    if (!activeProject) {
      appendLog("Could not resolve the active project for Everslice.", "warn");
      return;
    }

    const trimmedName = entityName.trim() || frozen.selection.text.trim();
    if (!trimmedName) {
      appendLog("Give the new entity a name before creating the Everslice link.", "warn");
      return;
    }

    try {
      const created = await window.evernear.createEntity({
        projectId: activeProject.id,
        name: trimmedName,
      });
      applyWorkspace(created, `Created entity "${trimmedName}".`);
      const entityId = created.layout.selectedEntityId;
      if (!entityId) {
        appendLog("Could not resolve the newly-created entity's id.", "warn");
        return;
      }
      await runCommit(entityId, frozen);
    } catch (error) {
      appendLog(`Failed to create entity: ${stringifyError(error)}`, "warn");
    }
  }, [frozen, workspaceRef, applyWorkspace, appendLog, runCommit]);

  return {
    isOpen: frozen !== null,
    sourceText: frozen?.selection.text ?? "",
    sourceDocumentId: frozen?.sourceDocumentId ?? null,
    frozenPendingRange,
    open,
    close,
    confirmExisting,
    confirmNew,
  };
}
