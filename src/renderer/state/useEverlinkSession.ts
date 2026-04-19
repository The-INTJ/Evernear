// Owns the Everlink "session" half of the FB-001 flow: the chooser-side
// state where the author picks/creates an entity + matching rule + target
// document. Transitions into a placement (handled by usePendingPlacement)
// once the author confirms, but the transition itself lives in the
// composing useEverlinkPlacement facade.
//
// This hook has no editor-ref dependencies — it only reads selection data
// and writes session state + a handful of workspace mutations. Keeping it
// editor-free is what lets it land cleanly under the 250-line cap and lets
// FB-002 (Everslice) reuse the session shape without inheriting placement
// concerns.

import { useCallback, useMemo, useState } from "react";

import { normalizeForMatch } from "../editor/workbenchUtils";
import { truncate } from "../utils/formatting";
import type { EverlinkSession } from "./sessionTypes";
import type { WorkspaceHook } from "./useWorkspace";
import type { WorkspaceLookups } from "./useWorkspaceLookups";
import type { EditorSelectionsHook, SelectionSurface } from "./useEditorSelections";

// Resolved session prerequisites — what usePendingPlacement needs to open
// the placement surface. Materialized by `resolveSessionTargets` below;
// any IPC failure or missing prerequisite returns null instead of a partial.
export type ResolvedSessionTargets = {
  entityId: string;
  targetDocumentId: string;
  surface: SelectionSurface;
  sourceText: string;
};

export type EverlinkSessionHook = {
  session: EverlinkSession | null;
  exactSelectionEntityIds: string[];
  setSession: React.Dispatch<React.SetStateAction<EverlinkSession | null>>;
  openChooser: () => Promise<void>;
  createTargetDocumentFromChooser: () => Promise<void>;
  resolveSessionTargets: (session: EverlinkSession) => Promise<ResolvedSessionTargets | null>;
  resetSession: () => void;
};

type UseEverlinkSessionInput = {
  workspaceHook: WorkspaceHook;
  selections: EditorSelectionsHook;
  lookups: WorkspaceLookups;
};

export function useEverlinkSession(input: UseEverlinkSessionInput): EverlinkSessionHook {
  const { workspaceHook, selections, lookups } = input;
  const { workspace, applyWorkspace, runMutation, appendLog } = workspaceHook;
  const { mainSelection } = selections;

  const [session, setSession] = useState<EverlinkSession | null>(null);

  const exactSelectionEntityIds = useMemo(() => {
    if (!workspace || mainSelection.empty) return [];
    const normalizedSelection = normalizeForMatch(mainSelection.text.trim());
    if (!normalizedSelection) return [];
    const ids = workspace.matchingRules
      .filter((rule) => rule.kind !== "regex" && normalizeForMatch(rule.pattern) === normalizedSelection)
      .map((rule) => rule.entityId);
    return Array.from(new Set(ids));
  }, [workspace, mainSelection]);

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

    setSession(nextSession);
    await runMutation(() => window.evernear.updateLayout({
      panelOpen: true,
      panelMode: "chooser",
      selectedEntityId: preselectedEntityId,
    }));
  }, [workspace, mainSelection, exactSelectionEntityIds, lookups.entitiesById, appendLog, runMutation]);

  const createTargetDocumentFromChooser = useCallback(async () => {
    if (!workspace || !session) return;
    const activeProject = workspace.projects.find((project) => project.id === workspace.layout.activeProjectId) ?? null;
    const activeDocument = workspace.activeDocument;
    if (!activeProject) return;

    const title = session.newTargetDocumentTitle.trim();
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
    setSession((current) => current ? {
      ...current,
      targetDocumentId: nextWorkspace.panelDocument?.id ?? null,
      newTargetDocumentTitle: title,
    } : current);
  }, [workspace, session, lookups.documentsById, appendLog, applyWorkspace]);

  // Realize the session's intent into concrete records: create or pick the
  // entity, attach a matching rule for the source text, and (if the session
  // points at a freshly-named target) create the target document. Returns
  // the IDs the placement layer needs, or null if any prerequisite couldn't
  // be satisfied (a warning has already been logged in that case).
  const resolveSessionTargets = useCallback(async (next: EverlinkSession): Promise<ResolvedSessionTargets | null> => {
    if (!workspace) return null;
    const activeProject = workspace.projects.find((project) => project.id === workspace.layout.activeProjectId) ?? null;
    const activeDocument = workspace.activeDocument;
    if (!activeProject) return null;

    const sourceText = next.sourceText.trim();
    if (!sourceText) {
      appendLog("The Everlink session needs a non-empty source selection.", "warn");
      return null;
    }

    let entityId = next.selectedEntityId;
    if (!entityId) {
      const created = await window.evernear.createEntity({
        projectId: activeProject.id,
        name: next.entityNameDraft.trim() || sourceText,
      });
      applyWorkspace(created, `Created entity "${next.entityNameDraft.trim() || sourceText}".`);
      entityId = created.layout.selectedEntityId;
    }
    if (!entityId) {
      appendLog("Could not create or select an entity for this Everlink session.", "warn");
      return null;
    }

    const ruleExists = workspace.matchingRules.some((rule) =>
      rule.entityId === entityId && normalizeForMatch(rule.pattern) === normalizeForMatch(sourceText),
    );
    if (!ruleExists) {
      const upserted = await window.evernear.upsertMatchingRule({
        entityId, label: truncate(sourceText, 32), pattern: sourceText,
        kind: next.ruleKind, wholeWord: true, allowPossessive: true, enabled: true,
      });
      applyWorkspace(upserted, "Attached the selected text as an entity rule.");
    }

    let targetDocumentId = next.targetDocumentId ?? activeDocument?.id ?? null;
    if (next.newTargetDocumentTitle.trim().length > 0 && targetDocumentId === "__create__") {
      const created = await window.evernear.createDocument({
        projectId: activeProject.id,
        folderId: activeDocument ? lookups.documentsById.get(activeDocument.id)?.folderId ?? null : null,
        title: next.newTargetDocumentTitle.trim(),
        openInPanel: true,
      });
      applyWorkspace(created, `Created "${next.newTargetDocumentTitle.trim()}" for slice placement.`);
      targetDocumentId = created.panelDocument?.id
        ?? created.documents[created.documents.length - 1]?.id
        ?? null;
    }
    if (!targetDocumentId) {
      appendLog("Choose a target document before placing the slice.", "warn");
      return null;
    }

    const surface: SelectionSurface = targetDocumentId === activeDocument?.id ? "main" : "panel";
    return { entityId, targetDocumentId, surface, sourceText };
  }, [workspace, lookups.documentsById, appendLog, applyWorkspace]);

  const resetSession = useCallback(() => {
    setSession(null);
  }, []);

  return {
    session,
    exactSelectionEntityIds,
    setSession,
    openChooser,
    createTargetDocumentFromChooser,
    resolveSessionTargets,
    resetSession,
  };
}
