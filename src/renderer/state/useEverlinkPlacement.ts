// The Everlink session + pending-slice-placement flow.
//
// These two states are tightly coupled: an everlink session always
// transitions into a pending placement, and the placement ultimately
// commits a slice that references the entity/rule the session created.
// Keeping them in one hook means the caller doesn't have to orchestrate
// a multi-step handshake — they get openChooser / beginPlacement /
// commitPlacement / cancel on one object.
//
// The hook is deliberately thin over window.evernear: it calls the
// workspace hook's applyWorkspace + runMutation rather than managing
// its own IPC state, so mutations stay single-sourced.

import { useCallback, useMemo, useRef, useState } from "react";

import type {
  HarnessEditorHandle,
  PendingSliceRange,
} from "../editor/HarnessEditor";
import {
  buildTextAnchorFromSelection,
  normalizeForMatch,
  type EditorSelectionInfo,
} from "../editor/workbenchUtils";
import { truncate, stringifyError } from "../utils/formatting";
import type {
  EverlinkSession,
  PendingSlicePlacement,
} from "./sessionTypes";
import type { WorkspaceHook } from "./useWorkspace";
import type { WorkspaceLookups } from "./useWorkspaceLookups";
import type { EditorSelectionsHook, SelectionSurface } from "./useEditorSelections";

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
  const { workspace, applyWorkspace, runMutation, appendLog, flushPersistence, setBusy, commitInFlightRef } = workspaceHook;
  const { mainSelection, panelSelection, setSelection } = selections;

  const [everlinkSession, setEverlinkSession] = useState<EverlinkSession | null>(null);
  const [pendingPlacement, setPendingPlacement] = useState<PendingSlicePlacement | null>(null);
  const placementRef = useRef<PendingSlicePlacement | null>(null);
  placementRef.current = pendingPlacement;

  const mainPendingRange = useMemo<PendingSliceRange | null>(() => {
    if (!pendingPlacement || pendingPlacement.surface !== "main") return null;
    const { start, end } = pendingPlacement;
    if (start === null || end === null) return null;
    return { from: start, to: end, awaitingPlacement: start === end };
  }, [pendingPlacement]);

  const panelPendingRange = useMemo<PendingSliceRange | null>(() => {
    if (!pendingPlacement || pendingPlacement.surface !== "panel") return null;
    const { start, end } = pendingPlacement;
    if (start === null || end === null) return null;
    return { from: start, to: end, awaitingPlacement: start === end };
  }, [pendingPlacement]);

  const exactSelectionEntityIds = useMemo(() => {
    if (!workspace || mainSelection.empty) return [];
    const normalizedSelection = normalizeForMatch(mainSelection.text.trim());
    if (!normalizedSelection) return [];
    const ids = workspace.matchingRules
      .filter((rule) => rule.kind !== "regex" && normalizeForMatch(rule.pattern) === normalizedSelection)
      .map((rule) => rule.entityId);
    return Array.from(new Set(ids));
  }, [workspace, mainSelection]);

  const handleSelectionChange = useCallback((surface: SelectionSurface, selection: EditorSelectionInfo) => {
    setSelection(surface, selection);
    setPendingPlacement((current) => {
      if (!current || current.surface !== surface) {
        return current;
      }
      if (current.start === null) {
        return {
          ...current,
          start: selection.from,
          end: selection.empty ? selection.from : selection.to,
        };
      }
      return {
        ...current,
        end: selection.empty ? selection.from : selection.to,
      };
    });
  }, [setSelection]);

  const openChooser = useCallback(async () => {
    const activeDocument = workspace?.activeDocument ?? null;
    const selectedEntity = workspace?.entities.find(
      (entity) => entity.id === workspace?.layout.selectedEntityId,
    ) ?? null;
    if (!activeDocument || mainSelection.empty || mainSelection.text.trim().length === 0) {
      appendLog("Select some story text before starting Everlink it!.", "warn");
      return;
    }

    const preselectedEntityId = exactSelectionEntityIds[0] ?? selectedEntity?.id ?? null;
    const preselectedEntity = preselectedEntityId ? lookups.entitiesById.get(preselectedEntityId) ?? null : null;

    const nextSession: EverlinkSession = {
      sourceDocumentId: activeDocument.id,
      sourceSelection: mainSelection,
      sourceText: mainSelection.text,
      selectedEntityId: preselectedEntityId,
      entityNameDraft: preselectedEntity?.name ?? mainSelection.text.trim(),
      targetDocumentId: activeDocument.id,
      newTargetDocumentTitle: `${truncate(mainSelection.text.trim(), 24)} Notes`,
      ruleKind: "literal",
      mode: exactSelectionEntityIds.length > 0 ? "edit" : preselectedEntity ? "attach" : "create",
    };

    setEverlinkSession(nextSession);
    await runMutation(() => window.evernear.updateLayout({
      panelOpen: true,
      panelMode: "chooser",
      selectedEntityId: preselectedEntityId,
    }));
  }, [workspace, mainSelection, exactSelectionEntityIds, lookups.entitiesById, appendLog, runMutation]);

  const beginPlacement = useCallback(async () => {
    if (!workspace || !everlinkSession) return;
    const activeProject = workspace.projects.find((project) => project.id === workspace.layout.activeProjectId) ?? null;
    const activeDocument = workspace.activeDocument;
    if (!activeProject) return;

    const sourceText = everlinkSession.sourceText.trim();
    if (!sourceText) {
      appendLog("The Everlink session needs a non-empty source selection.", "warn");
      return;
    }

    let entityId = everlinkSession.selectedEntityId;

    if (!entityId) {
      const nextWorkspace = await window.evernear.createEntity({
        projectId: activeProject.id,
        name: everlinkSession.entityNameDraft.trim() || sourceText,
      });
      applyWorkspace(nextWorkspace, `Created entity "${everlinkSession.entityNameDraft.trim() || sourceText}".`);
      entityId = nextWorkspace.layout.selectedEntityId;
    }

    if (!entityId) {
      appendLog("Could not create or select an entity for this Everlink session.", "warn");
      return;
    }

    const matchingRuleExists = workspace.matchingRules.some((rule) =>
      rule.entityId === entityId && normalizeForMatch(rule.pattern) === normalizeForMatch(sourceText),
    );
    if (!matchingRuleExists) {
      const nextWorkspace = await window.evernear.upsertMatchingRule({
        entityId,
        label: truncate(sourceText, 32),
        pattern: sourceText,
        kind: everlinkSession.ruleKind,
        wholeWord: true,
        allowPossessive: true,
        enabled: true,
      });
      applyWorkspace(nextWorkspace, "Attached the selected text as an entity rule.");
    }

    let targetDocumentId = everlinkSession.targetDocumentId ?? activeDocument?.id ?? null;
    if (!targetDocumentId) {
      appendLog("Choose a target document before placing the slice.", "warn");
      return;
    }

    if (everlinkSession.newTargetDocumentTitle.trim().length > 0 && targetDocumentId === "__create__") {
      const nextWorkspace = await window.evernear.createDocument({
        projectId: activeProject.id,
        folderId: activeDocument ? lookups.documentsById.get(activeDocument.id)?.folderId ?? null : null,
        title: everlinkSession.newTargetDocumentTitle.trim(),
        openInPanel: true,
      });
      applyWorkspace(nextWorkspace, `Created "${everlinkSession.newTargetDocumentTitle.trim()}" for slice placement.`);
      targetDocumentId = nextWorkspace.panelDocument?.id
        ?? nextWorkspace.documents[nextWorkspace.documents.length - 1]?.id
        ?? null;
    }

    if (!targetDocumentId) {
      appendLog("Could not prepare a target document for slice placement.", "warn");
      return;
    }

    const surface: SelectionSurface = targetDocumentId === activeDocument?.id ? "main" : "panel";
    const nextWorkspace = surface === "panel"
      ? await window.evernear.openDocument({ documentId: targetDocumentId, surface: "panel" })
      : await window.evernear.updateLayout({
          panelOpen: true,
          panelMode: "placement",
          panelDocumentId: null,
          selectedEntityId: entityId,
        });
    applyWorkspace(nextWorkspace, "Started slice placement.");

    setPendingPlacement({
      entityId,
      sourceDocumentId: everlinkSession.sourceDocumentId,
      sourceText,
      targetDocumentId,
      surface,
      start: null,
      end: null,
    });
    setEverlinkSession(null);
  }, [workspace, everlinkSession, lookups.documentsById, appendLog, applyWorkspace]);

  const createTargetDocumentFromChooser = useCallback(async () => {
    if (!workspace || !everlinkSession) return;
    const activeProject = workspace.projects.find((project) => project.id === workspace.layout.activeProjectId) ?? null;
    const activeDocument = workspace.activeDocument;
    if (!activeProject) return;

    const title = everlinkSession.newTargetDocumentTitle.trim();
    if (!title) {
      appendLog("Name the new target document before creating it.", "warn");
      return;
    }

    const nextWorkspace = await window.evernear.createDocument({
      projectId: activeProject.id,
      folderId: activeDocument ? lookups.documentsById.get(activeDocument.id)?.folderId ?? null : null,
      title,
      openInPanel: true,
    });
    applyWorkspace(nextWorkspace, `Created target document "${title}".`);
    setEverlinkSession((current) => current ? {
      ...current,
      targetDocumentId: nextWorkspace.panelDocument?.id ?? null,
      newTargetDocumentTitle: title,
    } : current);
  }, [workspace, everlinkSession, lookups.documentsById, appendLog, applyWorkspace]);

  const commitPendingSlice = useCallback(async () => {
    const placement = placementRef.current;
    if (!workspace || !placement) return;
    const activeProject = workspace.projects.find((project) => project.id === workspace.layout.activeProjectId) ?? null;
    if (!activeProject) return;
    if (commitInFlightRef.current) return;

    const editor = placement.surface === "main" ? editorRefs.main.current : editorRefs.panel.current;
    if (!editor) {
      appendLog("The slice placement surface is not ready yet.", "warn");
      return;
    }

    let start = placement.start;
    let end = placement.end;
    if (start === null || end === null) {
      const selection = placement.surface === "main" ? mainSelection : panelSelection;
      start = selection.from;
      end = selection.empty ? selection.from : selection.to;
    }

    if (start === null || end === null) {
      appendLog("Click or select inside the target document before committing the slice.", "warn");
      return;
    }

    if (start === end) {
      const insertedRange = editor.replaceSelection(placement.sourceText);
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

      const targetSnapshot = refreshed.activeDocument?.id === placement.targetDocumentId
        ? refreshed.activeDocument
        : refreshed.panelDocument?.id === placement.targetDocumentId
          ? refreshed.panelDocument
          : null;

      if (!targetSnapshot) {
        throw new Error("Could not load the target document after slice placement.");
      }

      const anchor = buildTextAnchorFromSelection(targetSnapshot, {
        from: Math.min(start, end),
        to: Math.max(start, end),
        empty: false,
        text: placement.sourceText,
      });

      if (!anchor) {
        throw new Error("Could not build an anchored slice range from the committed placement.");
      }

      const nextWorkspace = await window.evernear.createSlice({
        projectId: activeProject.id,
        entityId: placement.entityId,
        documentId: placement.targetDocumentId,
        title: truncate(placement.sourceText.trim(), 42),
        anchor,
      });
      applyWorkspace(nextWorkspace, "Committed the slice and linked it to the selected entity.");
      setPendingPlacement(null);
    } catch (error) {
      appendLog(`Slice placement failed: ${stringifyError(error)}`, "warn");
    } finally {
      commitInFlightRef.current = false;
      setBusy(false);
    }
  }, [workspace, mainSelection, panelSelection, editorRefs, appendLog, applyWorkspace, flushPersistence, setBusy, commitInFlightRef]);

  const cancelFlow = useCallback(async () => {
    setPendingPlacement(null);
    setEverlinkSession(null);
    if (workspace) {
      await runMutation(() => window.evernear.updateLayout({ panelMode: "entities" }));
    }
  }, [workspace, runMutation]);

  const handleMainBlur = useCallback(async () => {
    const placement = placementRef.current;
    if (!placement || placement.surface !== "main") return;
    if ((placement.start ?? 0) === (placement.end ?? 0)) {
      await commitPendingSlice();
    }
  }, [commitPendingSlice]);

  const handlePanelBlur = useCallback(async () => {
    const placement = placementRef.current;
    if (!placement || placement.surface !== "panel") return;
    if ((placement.start ?? 0) === (placement.end ?? 0)) {
      await commitPendingSlice();
    }
  }, [commitPendingSlice]);

  const mutableEverlinkSessionSetter = setEverlinkSession as unknown as React.Dispatch<React.SetStateAction<EverlinkSession | null>>;

  return {
    everlinkSession,
    pendingPlacement,
    mainPendingRange,
    panelPendingRange,
    exactSelectionEntityIds,
    setSession: mutableEverlinkSessionSetter,
    openChooser,
    beginPlacement,
    createTargetDocumentFromChooser,
    commitPendingSlice,
    cancelFlow,
    handleSelectionChange,
    handleMainBlur,
    handlePanelBlur,
  };
}
