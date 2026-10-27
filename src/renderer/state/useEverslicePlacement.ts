// Owns Add slice (FB-002 "Everslice"): the author selects a passage in the
// current document and binds it to an entity without leaving the page.
// Freezes the selection at open() time so the author can type/click inside
// the chooser without losing the range, then commits on confirm using the
// shared re-anchoring helper. A new entity named in the chooser starts with
// the regex for its name, so it highlights everywhere straight away.

import { useCallback, useMemo, useState } from "react";
import type { MutableRefObject } from "react";

import type {
  HarnessEditorHandle,
  PendingSliceRange,
} from "../editor/HarnessEditor";
import type { EditorSelectionInfo } from "../editor/editorUtils";
import { patternFromText } from "../../shared/matchingPatterns";
import { stringifyError } from "../utils/formatting";
import { commitSliceWithFreshAnchor } from "./sliceCommit";
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
    notify,
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
      notify("Open a document before adding a slice.", "warn");
      return;
    }
    if (mainSelection.empty || mainSelection.text.trim().length === 0) {
      notify("Select some text before adding a slice.", "warn");
      return;
    }
    setFrozen({
      selection: mainSelection,
      sourceDocumentId: activeDocument.id,
    });
  }, [workspaceRef, mainSelection, notify]);

  const close = useCallback(() => {
    setFrozen(null);
  }, []);

  const runCommit = useCallback(async (entityId: string, currentFrozen: FrozenSelection): Promise<void> => {
    const editor = editorRef.current;
    if (!editor) {
      notify("The editor isn't ready yet.", "warn");
      return;
    }
    const workspace = workspaceRef.current;
    const activeProject = workspace?.projects.find(
      (project) => project.id === workspace.layout.activeProjectId,
    ) ?? null;
    if (!activeProject) {
      notify("Could not resolve the active project.", "warn");
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
      notify,
      setBusy,
      commitInFlightRef,
    });

    if (committed) {
      setFrozen(null);
    }
  }, [editorRef, workspaceRef, flushPersistence, applyWorkspace, notify, setBusy, commitInFlightRef]);

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
      notify("Could not resolve the active project.", "warn");
      return;
    }

    const trimmedName = entityName.trim() || frozen.selection.text.trim();
    if (!trimmedName) {
      notify("Give the new entity a name first.", "warn");
      return;
    }

    try {
      const created = await window.evernear.createEntity({
        projectId: activeProject.id,
        name: trimmedName,
        rules: [{ pattern: patternFromText(trimmedName), enabled: true }],
      });
      applyWorkspace(created, `Created entity "${trimmedName}".`);
      const entityId = created.layout.selectedEntityId;
      if (!entityId) {
        notify("Could not resolve the newly-created entity's id.", "warn");
        return;
      }
      await runCommit(entityId, frozen);
    } catch (error) {
      notify(`Failed to create entity: ${stringifyError(error)}`, "warn");
    }
  }, [frozen, workspaceRef, applyWorkspace, notify, runCommit]);

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
