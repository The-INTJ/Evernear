import { useEffect, useMemo, useRef, useState } from "react";

import {
  type JsonObject,
  type StoredDocumentSnapshot,
  collectDocumentMetrics,
} from "../shared/domain/document";
import type {
  ApplyDocumentTransactionResult,
  DocumentFolderRecord,
  DocumentSummary,
  EntityRecord,
  EntitySliceRecord,
  MatchingRuleKind,
  MatchingRuleRecord,
  PanelMode,
  SliceBoundaryRecord,
  SliceRecord,
  WorkspaceState,
  WorkspaceStatus,
} from "../shared/domain/workspace";
import { createEmptyHarnessSnapshot } from "../shared/domain/harnessFixture";
import {
  HarnessEditor,
  type HarnessEditorHandle,
  type HarnessEditorSnapshot,
  type PendingSliceRange,
} from "./editor/HarnessEditor";
import {
  buildTextAnchorFromSelection,
  normalizeForMatch,
  type EditorMatchingRule,
  type EditorSelectionInfo,
  type SerializedTransactionBundle,
} from "./editor/workbenchUtils";

type RunLogTone = "info" | "success" | "warn";

type RunLogEntry = {
  id: number;
  message: string;
  tone: RunLogTone;
  createdAt: string;
};

type RuleFormState = {
  label: string;
  pattern: string;
  kind: MatchingRuleKind;
  wholeWord: boolean;
  allowPossessive: boolean;
  enabled: boolean;
};

type EverlinkSession = {
  sourceDocumentId: string;
  sourceSelection: EditorSelectionInfo;
  sourceText: string;
  selectedEntityId: string | null;
  entityNameDraft: string;
  targetDocumentId: string | null;
  newTargetDocumentTitle: string;
  ruleKind: MatchingRuleKind;
  mode: "create" | "attach" | "edit";
};

type PendingSlicePlacement = {
  entityId: string;
  sourceDocumentId: string;
  sourceText: string;
  targetDocumentId: string;
  surface: "main" | "panel";
  start: number | null;
  end: number | null;
};

type HoverPreview = {
  entityId: string;
  x: number;
  y: number;
};

const initialRuleForm: RuleFormState = {
  label: "",
  pattern: "",
  kind: "literal",
  wholeWord: true,
  allowPossessive: true,
  enabled: true,
};

export function App() {
  const mainEditorRef = useRef<HarnessEditorHandle | null>(null);
  const panelEditorRef = useRef<HarnessEditorHandle | null>(null);
  const workspaceRef = useRef<WorkspaceState | null>(null);
  const persistenceQueueRef = useRef<Promise<void>>(Promise.resolve());
  const documentVersionsRef = useRef(new Map<string, number>());
  const commitInFlightRef = useRef(false);

  const [status, setStatus] = useState<WorkspaceStatus | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceState | null>(null);
  const [pendingWrites, setPendingWrites] = useState(0);
  const [isBusy, setIsBusy] = useState(false);
  const [runLog, setRunLog] = useState<RunLogEntry[]>([]);
  const [mainSelection, setMainSelection] = useState<EditorSelectionInfo>({ from: 0, to: 0, empty: true, text: "" });
  const [panelSelection, setPanelSelection] = useState<EditorSelectionInfo>({ from: 0, to: 0, empty: true, text: "" });
  const [projectNameDraft, setProjectNameDraft] = useState("");
  const [documentTitleDraft, setDocumentTitleDraft] = useState("");
  const [newFolderTitle, setNewFolderTitle] = useState("");
  const [newDocumentTitle, setNewDocumentTitle] = useState("");
  const [ruleForm, setRuleForm] = useState<RuleFormState>(initialRuleForm);
  const [entityNameDraft, setEntityNameDraft] = useState("");
  const [everlinkSession, setEverlinkSession] = useState<EverlinkSession | null>(null);
  const [pendingPlacement, setPendingPlacement] = useState<PendingSlicePlacement | null>(null);
  const [hoverPreview, setHoverPreview] = useState<HoverPreview | null>(null);

  useEffect(() => {
    void initializeWorkspace();
  }, []);

  useEffect(() => {
    const activeProject = getActiveProject(workspace);
    setProjectNameDraft(activeProject?.name ?? "");
  }, [workspace?.layout.activeProjectId, workspace?.projects]);

  useEffect(() => {
    setDocumentTitleDraft(workspace?.activeDocument?.title ?? "");
  }, [workspace?.activeDocument?.id, workspace?.activeDocument?.title]);

  useEffect(() => {
    const selectedEntity = getSelectedEntity(workspace);
    setEntityNameDraft(selectedEntity?.name ?? "");
  }, [workspace?.layout.selectedEntityId, workspace?.entities]);

  const activeProject = getActiveProject(workspace);
  const activeDocument = workspace?.activeDocument ?? null;
  const panelDocument = workspace?.panelDocument ?? null;
  const selectedEntity = getSelectedEntity(workspace);

  const entitiesById = useMemo(() => {
    const next = new Map<string, EntityRecord>();
    workspace?.entities.forEach((entity) => next.set(entity.id, entity));
    return next;
  }, [workspace?.entities]);

  const slicesById = useMemo(() => {
    const next = new Map<string, SliceRecord>();
    workspace?.slices.forEach((slice) => next.set(slice.id, slice));
    return next;
  }, [workspace?.slices]);

  const boundariesBySliceId = useMemo(() => {
    const next = new Map<string, SliceBoundaryRecord>();
    workspace?.sliceBoundaries.forEach((boundary) => next.set(boundary.sliceId, boundary));
    return next;
  }, [workspace?.sliceBoundaries]);

  const documentsById = useMemo(() => {
    const next = new Map<string, DocumentSummary>();
    workspace?.documents.forEach((document) => next.set(document.id, document));
    return next;
  }, [workspace?.documents]);

  const editorRules = useMemo<EditorMatchingRule[]>(() => {
    if (!workspace) {
      return [];
    }

    return workspace.matchingRules.map((rule) => ({
      ...rule,
      entityName: entitiesById.get(rule.entityId)?.name ?? "Entity",
    }));
  }, [workspace, entitiesById]);

  const exactSelectionEntityIds = useMemo(() => {
    if (!workspace || mainSelection.empty) {
      return [];
    }

    const normalizedSelection = normalizeForMatch(mainSelection.text.trim());
    if (!normalizedSelection) {
      return [];
    }

    return uniqueStrings(
      workspace.matchingRules
        .filter((rule) => rule.kind !== "regex")
        .filter((rule) => normalizeForMatch(rule.pattern) === normalizedSelection)
        .map((rule) => rule.entityId),
    );
  }, [workspace, mainSelection]);

  const selectedEntitySlices = useMemo(() => {
    if (!workspace || !selectedEntity) {
      return [] as Array<{
        slice: SliceRecord;
        boundary: SliceBoundaryRecord | undefined;
        document: DocumentSummary | undefined;
      }>;
    }

    return workspace.entitySlices
      .filter((link) => link.entityId === selectedEntity.id)
      .sort((left, right) => left.ordering - right.ordering)
      .flatMap((link) => {
        const slice = slicesById.get(link.sliceId);
        if (!slice) {
          return [];
        }
        return [{
          slice,
          boundary: boundariesBySliceId.get(slice.id),
          document: documentsById.get(slice.documentId),
        }];
      });
  }, [workspace, selectedEntity, slicesById, boundariesBySliceId, documentsById]);

  const mainVisibleBoundaries = useMemo(() => {
    if (!workspace || !activeDocument) {
      return [] as SliceBoundaryRecord[];
    }

    const allowedSliceIds = new Set<string>();
    if (selectedEntity) {
      workspace.entitySlices
        .filter((link) => link.entityId === selectedEntity.id)
        .forEach((link) => allowedSliceIds.add(link.sliceId));
    }

    if (pendingPlacement?.entityId) {
      workspace.entitySlices
        .filter((link) => link.entityId === pendingPlacement.entityId)
        .forEach((link) => allowedSliceIds.add(link.sliceId));
    }

    return workspace.sliceBoundaries.filter((boundary) =>
      boundary.documentId === activeDocument.id
      && (allowedSliceIds.size === 0 || allowedSliceIds.has(boundary.sliceId)));
  }, [workspace, activeDocument, selectedEntity, pendingPlacement]);

  const panelVisibleBoundaries = useMemo(() => {
    if (!workspace || !panelDocument) {
      return [] as SliceBoundaryRecord[];
    }

    const selectedSliceIds = new Set<string>(
      selectedEntity
        ? workspace.entitySlices.filter((link) => link.entityId === selectedEntity.id).map((link) => link.sliceId)
        : [],
    );

    return workspace.sliceBoundaries.filter((boundary) =>
      boundary.documentId === panelDocument.id
      && (selectedSliceIds.size === 0 || selectedSliceIds.has(boundary.sliceId)));
  }, [workspace, panelDocument, selectedEntity]);

  const mainPendingRange = useMemo<PendingSliceRange | null>(() => {
    if (!pendingPlacement || pendingPlacement.surface !== "main") {
      return null;
    }

    const start = pendingPlacement.start;
    const end = pendingPlacement.end;
    if (start === null || end === null) {
      return null;
    }

    return { from: start, to: end, awaitingPlacement: start === end };
  }, [pendingPlacement]);

  const panelPendingRange = useMemo<PendingSliceRange | null>(() => {
    if (!pendingPlacement || pendingPlacement.surface !== "panel") {
      return null;
    }

    const start = pendingPlacement.start;
    const end = pendingPlacement.end;
    if (start === null || end === null) {
      return null;
    }

    return { from: start, to: end, awaitingPlacement: start === end };
  }, [pendingPlacement]);

  const hoverEntity = hoverPreview ? entitiesById.get(hoverPreview.entityId) ?? null : null;
  const hoverSlices = hoverPreview && hoverEntity
    ? selectedSlicesForEntity(hoverPreview.entityId, workspace, slicesById, boundariesBySliceId, documentsById)
    : [];

  async function initializeWorkspace(): Promise<void> {
    setIsBusy(true);

    try {
      const [nextStatus, nextWorkspace] = await Promise.all([
        window.evernear.getStatus(),
        window.evernear.loadWorkspace(),
      ]);
      setStatus(nextStatus);
      applyWorkspace(nextWorkspace, "Workspace opened against the persisted project store.");
    } catch (error) {
      appendLog(`Failed to initialize Evernear: ${stringifyError(error)}`, "warn");
    } finally {
      setIsBusy(false);
    }
  }

  function applyWorkspace(nextWorkspace: WorkspaceState, message?: string): void {
    workspaceRef.current = nextWorkspace;
    setWorkspace(nextWorkspace);
    syncDocumentVersions(nextWorkspace);
    if (message) {
      appendLog(message, "success");
    }
  }

  function syncDocumentVersions(nextWorkspace: WorkspaceState): void {
    documentVersionsRef.current.clear();
    if (nextWorkspace.activeDocument) {
      documentVersionsRef.current.set(nextWorkspace.activeDocument.id, nextWorkspace.activeDocument.currentVersion);
    }
    if (nextWorkspace.panelDocument) {
      documentVersionsRef.current.set(nextWorkspace.panelDocument.id, nextWorkspace.panelDocument.currentVersion);
    }
  }

  function appendLog(message: string, tone: RunLogTone): void {
    setRunLog((current) => [{
      id: current.length + 1,
      message,
      tone,
      createdAt: new Date().toLocaleTimeString(),
    }, ...current].slice(0, 30));
  }

  async function flushPersistence(): Promise<void> {
    await persistenceQueueRef.current.catch(() => undefined);
  }

  async function runWorkspaceMutation(
    task: () => Promise<WorkspaceState>,
    successMessage?: string,
  ): Promise<void> {
    setIsBusy(true);

    try {
      await flushPersistence();
      const nextWorkspace = await task();
      applyWorkspace(nextWorkspace, successMessage);
    } catch (error) {
      appendLog(stringifyError(error), "warn");
    } finally {
      setIsBusy(false);
    }
  }

  function patchWorkspaceDocument(result: ApplyDocumentTransactionResult): void {
    const current = workspaceRef.current;
    if (!current) {
      return;
    }

    const nextDocuments = current.documents.map((document) =>
      document.id === result.summary.id ? result.summary : document);
    const nextBoundaries = [
      ...current.sliceBoundaries.filter((boundary) => boundary.documentId !== result.snapshot.id),
      ...result.sliceBoundaries,
    ];

    const nextWorkspace: WorkspaceState = {
      ...current,
      documents: nextDocuments,
      activeDocument: current.activeDocument?.id === result.snapshot.id ? result.snapshot : current.activeDocument,
      panelDocument: current.panelDocument?.id === result.snapshot.id ? result.snapshot : current.panelDocument,
      sliceBoundaries: nextBoundaries,
    };

    applyWorkspace(nextWorkspace);
  }

  function queueDocumentPersistence(
    documentId: string,
    title: string,
    snapshot: HarnessEditorSnapshot,
    transaction: SerializedTransactionBundle,
  ): void {
    setPendingWrites((current) => current + 1);

    persistenceQueueRef.current = persistenceQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        const baseVersion = documentVersionsRef.current.get(documentId) ?? 0;
        const result = await window.evernear.applyDocumentTransaction({
          documentId,
          baseVersion,
          title,
          steps: transaction.steps,
          inverseSteps: transaction.inverseSteps,
          contentJson: snapshot.contentJson,
          plainText: snapshot.plainText,
        });

        documentVersionsRef.current.set(documentId, result.snapshot.currentVersion);
        patchWorkspaceDocument(result);
      })
      .catch((error) => {
        appendLog(`Document persistence drifted: ${stringifyError(error)}`, "warn");
      })
      .finally(() => {
        setPendingWrites((current) => Math.max(0, current - 1));
      });
  }

  function handleMainSnapshotChange(
    snapshot: HarnessEditorSnapshot,
    transaction: SerializedTransactionBundle | null,
  ): void {
    if (transaction && activeDocument) {
      queueDocumentPersistence(activeDocument.id, documentTitleDraft || activeDocument.title, snapshot, transaction);
    }
  }

  function handlePanelSnapshotChange(
    snapshot: HarnessEditorSnapshot,
    transaction: SerializedTransactionBundle | null,
  ): void {
    if (transaction && panelDocument) {
      queueDocumentPersistence(panelDocument.id, panelDocument.title, snapshot, transaction);
    }
  }

  function handleSelectionChange(surface: "main" | "panel", selection: EditorSelectionInfo): void {
    if (surface === "main") {
      setMainSelection(selection);
    } else {
      setPanelSelection(selection);
    }

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
  }

  async function handleProjectSwitch(projectId: string): Promise<void> {
    if (!projectId || projectId === workspace?.layout.activeProjectId) {
      return;
    }

    await runWorkspaceMutation(
      () => window.evernear.openProject({ projectId }),
      "Opened the selected project.",
    );
  }

  async function handleCreateProject(): Promise<void> {
    const nextIndex = (workspace?.projects.length ?? 0) + 1;
    await runWorkspaceMutation(
      () => window.evernear.createProject({ name: `Untitled Project ${nextIndex}` }),
      "Created a fresh local project.",
    );
  }

  async function handleSaveProjectName(): Promise<void> {
    if (!activeProject || projectNameDraft.trim() === activeProject.name) {
      return;
    }

    await runWorkspaceMutation(
      () => window.evernear.updateProject({ projectId: activeProject.id, name: projectNameDraft }),
      "Updated the project name.",
    );
  }

  async function handleCreateFolder(): Promise<void> {
    if (!activeProject) {
      return;
    }

    const title = newFolderTitle.trim() || `Folder ${countForLabel(workspace?.folders.length ?? 0)}`;
    setNewFolderTitle("");
    await runWorkspaceMutation(
      () => window.evernear.createFolder({ projectId: activeProject.id, title }),
      `Created folder "${title}".`,
    );
  }

  async function handleCreateDocument(folderId: string | null, openInPanel = false): Promise<void> {
    if (!activeProject) {
      return;
    }

    const title = newDocumentTitle.trim() || `Document ${countForLabel(workspace?.documents.length ?? 0)}`;
    setNewDocumentTitle("");
    await runWorkspaceMutation(
      () => window.evernear.createDocument({ projectId: activeProject.id, folderId, title, openInPanel }),
      `Created document "${title}".`,
    );
  }

  async function handleOpenDocument(documentId: string): Promise<void> {
    await runWorkspaceMutation(
      () => window.evernear.openDocument({ documentId, surface: "main" }),
      "Opened the selected document.",
    );
  }

  async function handleSaveDocumentMeta(nextFolderId?: string | null): Promise<void> {
    if (!activeDocument) {
      return;
    }

    const payload = {
      documentId: activeDocument.id,
      title: documentTitleDraft.trim() || activeDocument.title,
      folderId: nextFolderId === undefined ? undefined : nextFolderId,
    };

    await runWorkspaceMutation(
      () => window.evernear.updateDocumentMeta(payload),
      "Updated document metadata.",
    );
  }

  async function handleDeleteDocument(): Promise<void> {
    if (!activeDocument) {
      return;
    }

    await runWorkspaceMutation(
      () => window.evernear.deleteDocument({ documentId: activeDocument.id }),
      `Deleted "${activeDocument.title}".`,
    );
  }

  async function handleReorderDocument(direction: "up" | "down"): Promise<void> {
    if (!activeDocument) {
      return;
    }

    await runWorkspaceMutation(
      () => window.evernear.reorderDocument({ documentId: activeDocument.id, direction }),
      `Moved "${activeDocument.title}" ${direction}.`,
    );
  }

  async function handleToggleFolder(folderId: string): Promise<void> {
    if (!workspace) {
      return;
    }

    const expanded = workspace.layout.expandedFolderIds.includes(folderId);
    await runWorkspaceMutation(
      () => window.evernear.updateLayout({
        expandedFolderIds: expanded
          ? workspace.layout.expandedFolderIds.filter((id) => id !== folderId)
          : [...workspace.layout.expandedFolderIds, folderId],
      }),
    );
  }

  async function handleRenameFolder(folder: DocumentFolderRecord, title: string): Promise<void> {
    if (title.trim() === folder.title) {
      return;
    }

    await runWorkspaceMutation(
      () => window.evernear.updateFolder({ folderId: folder.id, title }),
      "Updated folder title.",
    );
  }

  async function handleDeleteFolder(folderId: string): Promise<void> {
    await runWorkspaceMutation(
      () => window.evernear.deleteFolder({ folderId }),
      "Deleted the folder and moved its documents to the project root.",
    );
  }

  async function handleToggleHighlights(): Promise<void> {
    if (!workspace) {
      return;
    }

    await runWorkspaceMutation(
      () => window.evernear.updateLayout({
        highlightsEnabled: !workspace.layout.highlightsEnabled,
      }),
    );
  }

  async function handleTogglePanel(): Promise<void> {
    if (!workspace) {
      return;
    }

    await runWorkspaceMutation(
      () => window.evernear.updateLayout({
        panelOpen: !workspace.layout.panelOpen,
      }),
    );
  }

  async function handleSelectEntity(entityId: string): Promise<void> {
    await runWorkspaceMutation(
      () => window.evernear.updateLayout({
        selectedEntityId: entityId,
        panelOpen: true,
        panelMode: "entities",
      }),
    );
  }

  async function handleSaveEntityName(): Promise<void> {
    if (!selectedEntity || entityNameDraft.trim() === selectedEntity.name) {
      return;
    }

    await runWorkspaceMutation(
      () => window.evernear.updateEntity({ entityId: selectedEntity.id, name: entityNameDraft }),
      "Updated the entity name.",
    );
  }

  async function handleCreateEntityRule(): Promise<void> {
    if (!selectedEntity) {
      return;
    }

    if (ruleForm.pattern.trim().length === 0 || ruleForm.label.trim().length === 0) {
      appendLog("Matching rules need both a label and a pattern.", "warn");
      return;
    }

    const form = ruleForm;
    setRuleForm(initialRuleForm);
    await runWorkspaceMutation(
      () => window.evernear.upsertMatchingRule({
        entityId: selectedEntity.id,
        label: form.label.trim(),
        kind: form.kind,
        pattern: form.pattern,
        wholeWord: form.wholeWord,
        allowPossessive: form.allowPossessive,
        enabled: form.enabled,
      }),
      `Added rule "${form.label.trim()}".`,
    );
  }

  async function handleCreateManualEntity(): Promise<void> {
    if (!activeProject) {
      return;
    }

    const nextIndex = (workspace?.entities.length ?? 0) + 1;
    await runWorkspaceMutation(
      () => window.evernear.createEntity({
        projectId: activeProject.id,
        name: `Entity ${nextIndex}`,
      }),
      "Created a new empty entity.",
    );
  }

  async function handleToggleRule(rule: MatchingRuleRecord): Promise<void> {
    await runWorkspaceMutation(
      () => window.evernear.upsertMatchingRule({
        id: rule.id,
        entityId: rule.entityId,
        label: rule.label,
        kind: rule.kind,
        pattern: rule.pattern,
        wholeWord: rule.wholeWord,
        allowPossessive: rule.allowPossessive,
        enabled: !rule.enabled,
      }),
    );
  }

  async function handleDeleteRule(ruleId: string): Promise<void> {
    await runWorkspaceMutation(
      () => window.evernear.deleteMatchingRule({ ruleId }),
      "Deleted the matching rule.",
    );
  }

  async function handleDeleteEntity(): Promise<void> {
    if (!selectedEntity) {
      return;
    }

    await runWorkspaceMutation(
      () => window.evernear.deleteEntity({ entityId: selectedEntity.id }),
      `Deleted "${selectedEntity.name}" and cleaned up orphaned slice records.`,
    );
  }

  async function handleDeleteSlice(sliceId: string): Promise<void> {
    await runWorkspaceMutation(
      () => window.evernear.deleteSlice({ sliceId }),
      "Deleted the slice.",
    );
  }

  async function openEverlinkChooser(): Promise<void> {
    if (!activeDocument || mainSelection.empty || mainSelection.text.trim().length === 0) {
      appendLog("Select some story text before starting Everlink it!.", "warn");
      return;
    }

    const preselectedEntityId = exactSelectionEntityIds[0] ?? selectedEntity?.id ?? null;
    const preselectedEntity = preselectedEntityId ? entitiesById.get(preselectedEntityId) ?? null : null;
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
    await runWorkspaceMutation(
      () => window.evernear.updateLayout({
        panelOpen: true,
        panelMode: "chooser",
        selectedEntityId: preselectedEntityId,
      }),
    );
  }

  async function handleBeginPlacement(): Promise<void> {
    if (!workspace || !activeProject || !everlinkSession) {
      return;
    }

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
        folderId: activeDocument?.id ? documentsById.get(activeDocument.id)?.folderId ?? null : null,
        title: everlinkSession.newTargetDocumentTitle.trim(),
        openInPanel: true,
      });
      applyWorkspace(nextWorkspace, `Created "${everlinkSession.newTargetDocumentTitle.trim()}" for slice placement.`);
      targetDocumentId = nextWorkspace.panelDocument?.id ?? nextWorkspace.documents[nextWorkspace.documents.length - 1]?.id ?? null;
    }

    if (!targetDocumentId) {
      appendLog("Could not prepare a target document for slice placement.", "warn");
      return;
    }

    const surface: "main" | "panel" = targetDocumentId === activeDocument?.id ? "main" : "panel";

    const nextWorkspace = surface === "panel"
      ? await window.evernear.openDocument({ documentId: targetDocumentId, surface: "panel" })
      : await window.evernear.updateLayout({ panelOpen: true, panelMode: "placement", panelDocumentId: null, selectedEntityId: entityId });
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
  }

  async function handleCreateTargetDocumentFromChooser(): Promise<void> {
    if (!activeProject || !everlinkSession) {
      return;
    }

    const title = everlinkSession.newTargetDocumentTitle.trim();
    if (!title) {
      appendLog("Name the new target document before creating it.", "warn");
      return;
    }

    const nextWorkspace = await window.evernear.createDocument({
      projectId: activeProject.id,
      folderId: activeDocument ? documentsById.get(activeDocument.id)?.folderId ?? null : null,
      title,
      openInPanel: true,
    });
    applyWorkspace(nextWorkspace, `Created target document "${title}".`);
    setEverlinkSession((current) => current ? {
      ...current,
      targetDocumentId: nextWorkspace.panelDocument?.id ?? null,
      newTargetDocumentTitle: title,
    } : current);
  }

  async function handleCommitPendingSlice(): Promise<void> {
    if (!workspace || !activeProject || !pendingPlacement) {
      return;
    }

    if (commitInFlightRef.current) {
      return;
    }

    const editor = pendingPlacement.surface === "main" ? mainEditorRef.current : panelEditorRef.current;
    if (!editor) {
      appendLog("The slice placement surface is not ready yet.", "warn");
      return;
    }

    let start = pendingPlacement.start;
    let end = pendingPlacement.end;
    if (start === null || end === null) {
      const selection = pendingPlacement.surface === "main" ? mainSelection : panelSelection;
      start = selection.from;
      end = selection.empty ? selection.from : selection.to;
    }

    if (start === null || end === null) {
      appendLog("Click or select inside the target document before committing the slice.", "warn");
      return;
    }

    if (start === end) {
      const insertedRange = editor.replaceSelection(pendingPlacement.sourceText);
      if (!insertedRange) {
        appendLog("Could not auto-fill the empty pending slice.", "warn");
        return;
      }
      start = insertedRange.from;
      end = insertedRange.to;
    }

    setIsBusy(true);
    commitInFlightRef.current = true;

    try {
      await flushPersistence();
      const refreshed = await window.evernear.loadWorkspace();
      applyWorkspace(refreshed);

      const targetSnapshot = refreshed.activeDocument?.id === pendingPlacement.targetDocumentId
        ? refreshed.activeDocument
        : refreshed.panelDocument?.id === pendingPlacement.targetDocumentId
          ? refreshed.panelDocument
          : null;

      if (!targetSnapshot) {
        throw new Error("Could not load the target document after slice placement.");
      }

      const anchor = buildTextAnchorFromSelection(targetSnapshot, {
        from: Math.min(start, end),
        to: Math.max(start, end),
        empty: false,
        text: pendingPlacement.sourceText,
      });

      if (!anchor) {
        throw new Error("Could not build an anchored slice range from the committed placement.");
      }

      const nextWorkspace = await window.evernear.createSlice({
        projectId: activeProject.id,
        entityId: pendingPlacement.entityId,
        documentId: pendingPlacement.targetDocumentId,
        title: truncate(pendingPlacement.sourceText.trim(), 42),
        anchor,
      });
      applyWorkspace(nextWorkspace, "Committed the slice and linked it to the selected entity.");
      setPendingPlacement(null);
      setHoverPreview(null);
    } catch (error) {
      appendLog(`Slice placement failed: ${stringifyError(error)}`, "warn");
    } finally {
      commitInFlightRef.current = false;
      setIsBusy(false);
    }
  }

  async function handleCancelPlacement(): Promise<void> {
    setPendingPlacement(null);
    setEverlinkSession(null);
    if (workspace) {
      await runWorkspaceMutation(
        () => window.evernear.updateLayout({
          panelMode: "entities",
        }),
      );
    }
  }

  async function handleOpenSliceInPanel(documentId: string, entityId: string): Promise<void> {
    const nextWorkspace = await window.evernear.openDocument({ documentId, surface: "panel" });
    applyWorkspace(nextWorkspace, "Opened the slice document in the persistent panel.");
    await runWorkspaceMutation(
      () => window.evernear.updateLayout({
        selectedEntityId: entityId,
        panelMode: "document",
        panelOpen: true,
      }),
    );
  }

  async function handleEditorHover(payload: { entityId: string; clientX: number; clientY: number } | null): Promise<void> {
    if (!payload) {
      setHoverPreview(null);
      return;
    }

    setHoverPreview({
      entityId: payload.entityId,
      x: payload.clientX,
      y: payload.clientY,
    });
  }

  async function handleEditorClick(entityId: string): Promise<void> {
    await runWorkspaceMutation(
      () => window.evernear.updateLayout({
        selectedEntityId: entityId,
        panelOpen: true,
        panelMode: "entities",
      }),
      "Opened the entity panel from an in-text match.",
    );
  }

  async function handlePanelBlur(): Promise<void> {
    if (!pendingPlacement || pendingPlacement.surface !== "panel") {
      return;
    }

    if ((pendingPlacement.start ?? 0) === (pendingPlacement.end ?? 0)) {
      await handleCommitPendingSlice();
    }
  }

  async function handleMainBlur(): Promise<void> {
    if (!pendingPlacement || pendingPlacement.surface !== "main") {
      return;
    }

    if ((pendingPlacement.start ?? 0) === (pendingPlacement.end ?? 0)) {
      await handleCommitPendingSlice();
    }
  }

  const documentsByFolder = useMemo(() => groupDocumentsByFolder(workspace?.documents ?? []), [workspace?.documents]);

  const rootDocuments = documentsByFolder.get(null) ?? [];

  const selectedEntityRules = selectedEntity
    ? workspace?.matchingRules.filter((rule) => rule.entityId === selectedEntity.id) ?? []
    : [];

  const everlinkLabel = exactSelectionEntityIds.length > 0 ? "Edit Everlink" : "Everlink it!";
  const emptySnapshot = createEmptyHarnessSnapshot();

  return (
    <div className="mvp-shell">
      <header className="mvp-topbar">
        <div className="brand-block">
          <span className="eyebrow">Evernear MVP</span>
          <h1>Writing Workspace</h1>
          <p className="toolbar-note">
            Local-first folders, generic documents, entity-aware highlights, and slice authoring in a persistent panel.
          </p>
        </div>
        <div className="topbar-actions">
          <label className="field-stack field-stack--compact">
            <span className="field-label">Project</span>
            <select
              className="select-input"
              value={workspace?.layout.activeProjectId ?? ""}
              onChange={(event) => void handleProjectSwitch(event.target.value)}
            >
              {(workspace?.projects ?? []).map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </label>
          <button className="secondary-button" onClick={() => void handleCreateProject()} type="button">
            New Project
          </button>
          <button className="secondary-button" onClick={() => void handleTogglePanel()} type="button">
            {workspace?.layout.panelOpen ? "Hide Panel" : "Show Panel"}
          </button>
        </div>
      </header>

      <main className={workspace?.layout.panelOpen ? "mvp-grid" : "mvp-grid mvp-grid--panel-closed"}>
        <aside className="nav-panel">
          <section className="panel-section">
            <p className="section-kicker">Project</p>
            <input
              className="text-input"
              value={projectNameDraft}
              onChange={(event) => setProjectNameDraft(event.target.value)}
              onBlur={() => void handleSaveProjectName()}
              placeholder="Project name"
            />
            <div className="toolbar-actions">
              <input
                className="text-input"
                value={newFolderTitle}
                onChange={(event) => setNewFolderTitle(event.target.value)}
                placeholder="New folder"
              />
              <button className="ghost-button" onClick={() => void handleCreateFolder()} type="button">
                Add Folder
              </button>
            </div>
            <div className="toolbar-actions">
              <input
                className="text-input"
                value={newDocumentTitle}
                onChange={(event) => setNewDocumentTitle(event.target.value)}
                placeholder="New document"
              />
              <button className="ghost-button" onClick={() => void handleCreateDocument(activeDocument ? documentsById.get(activeDocument.id)?.folderId ?? null : null)} type="button">
                Add Doc
              </button>
            </div>
          </section>

          <section className="panel-section">
            <p className="section-kicker">Documents</p>
            <div className="tree-list">
              {(workspace?.folders ?? []).map((folder) => {
                const expanded = workspace?.layout.expandedFolderIds.includes(folder.id) ?? false;
                const folderDocuments = documentsByFolder.get(folder.id) ?? [];
                return (
                  <article key={folder.id} className="tree-folder">
                    <div className="tree-folder__header">
                      <button className="tree-toggle" onClick={() => void handleToggleFolder(folder.id)} type="button">
                        {expanded ? "−" : "+"}
                      </button>
                      <input
                        className="tree-folder__input"
                        defaultValue={folder.title}
                        onBlur={(event) => void handleRenameFolder(folder, event.target.value)}
                      />
                      <button className="tree-inline-button" onClick={() => void handleCreateDocument(folder.id)} type="button">
                        + Doc
                      </button>
                      <button className="tree-inline-button tree-inline-button--danger" onClick={() => void handleDeleteFolder(folder.id)} type="button">
                        Delete
                      </button>
                    </div>
                    {expanded ? (
                      <div className="tree-documents">
                        {folderDocuments.length === 0 ? (
                          <p className="empty-state">No documents here yet.</p>
                        ) : (
                          folderDocuments.map((document) => (
                            <button
                              key={document.id}
                              className={document.id === activeDocument?.id ? "tree-document tree-document--active" : "tree-document"}
                              onClick={() => void handleOpenDocument(document.id)}
                              type="button"
                            >
                              <span>{document.title}</span>
                              <small>{formatCount(document.wordCount)} words</small>
                            </button>
                          ))
                        )}
                      </div>
                    ) : null}
                  </article>
                );
              })}

              {rootDocuments.length > 0 ? (
                <article className="tree-folder">
                  <div className="tree-folder__header tree-folder__header--static">
                    <strong>Loose Documents</strong>
                  </div>
                  <div className="tree-documents">
                    {rootDocuments.map((document) => (
                      <button
                        key={document.id}
                        className={document.id === activeDocument?.id ? "tree-document tree-document--active" : "tree-document"}
                        onClick={() => void handleOpenDocument(document.id)}
                        type="button"
                      >
                        <span>{document.title}</span>
                        <small>{formatCount(document.wordCount)} words</small>
                      </button>
                    ))}
                  </div>
                </article>
              ) : null}
            </div>
          </section>
        </aside>

        <section className="editor-panel">
          <div className="editor-toolbar">
            <div className="field-stack field-stack--grow">
              <span className="field-label">Document</span>
              <input
                className="text-input text-input--title"
                value={documentTitleDraft}
                onChange={(event) => setDocumentTitleDraft(event.target.value)}
                onBlur={() => void handleSaveDocumentMeta()}
                placeholder="Document title"
              />
            </div>
            <label className="field-stack field-stack--compact">
              <span className="field-label">Folder</span>
              <select
                className="select-input"
                value={activeDocument ? documentsById.get(activeDocument.id)?.folderId ?? "" : ""}
                onChange={(event) => void handleSaveDocumentMeta(event.target.value || null)}
              >
                <option value="">Project Root</option>
                {(workspace?.folders ?? []).map((folder) => (
                  <option key={folder.id} value={folder.id}>{folder.title}</option>
                ))}
              </select>
            </label>
            <div className="toolbar-actions">
              <button className="ghost-button" onClick={() => mainEditorRef.current?.toggleBold()} type="button">
                Bold
              </button>
              <button className="ghost-button" onClick={() => mainEditorRef.current?.toggleItalic()} type="button">
                Italic
              </button>
              <button className="ghost-button" onClick={() => void handleReorderDocument("up")} type="button">
                Move Up
              </button>
              <button className="ghost-button" onClick={() => void handleReorderDocument("down")} type="button">
                Move Down
              </button>
              <button className="ghost-button" onClick={() => void handleToggleHighlights()} type="button">
                {workspace?.layout.highlightsEnabled ? "Mute Highlights" : "Show Highlights"}
              </button>
              <button className="primary-button" onClick={() => void openEverlinkChooser()} type="button">
                {everlinkLabel}
              </button>
              <button className="ghost-button ghost-button--danger" onClick={() => void handleDeleteDocument()} type="button">
                Delete Doc
              </button>
            </div>
          </div>

          <div className="editor-statusbar">
            <MetricCard label="Words" value={formatCount(activeDocument ? collectDocumentMetrics(activeDocument.plainText).wordCount : 0)} />
            <MetricCard label="Paragraphs" value={formatCount(activeDocument ? collectDocumentMetrics(activeDocument.plainText).paragraphCount : 0)} />
            <MetricCard label="Characters" value={formatCount(activeDocument ? collectDocumentMetrics(activeDocument.plainText).characterCount : 0)} />
            <MetricCard label="Storage" value={status?.storageEngine ?? "better-sqlite3"} />
            <MetricCard label="Sync" value={pendingWrites > 0 ? "Saving..." : "Saved"} />
          </div>

          <div className="editor-canvas">
            <HarnessEditor
              key={activeDocument?.id ?? emptySnapshot.id}
              ref={mainEditorRef}
              initialDocumentJson={activeDocument?.contentJson ?? emptySnapshot.contentJson}
              decorationsEnabled
              matchingRules={workspace?.layout.highlightsEnabled ? editorRules : []}
              sliceBoundaries={mainVisibleBoundaries}
              pendingRange={mainPendingRange}
              legendLabels={{
                match: "Entity match",
                boundary: "Slice boundary",
                pending: "Pending slice",
              }}
              onDocumentSnapshotChange={handleMainSnapshotChange}
              onSelectionChange={(selection) => handleSelectionChange("main", selection)}
              onEntityHover={(payload) => void handleEditorHover(payload)}
              onEntityClick={(entityId) => void handleEditorClick(entityId)}
              onBlur={() => void handleMainBlur()}
            />
          </div>
        </section>

        {workspace?.layout.panelOpen ? (
          <aside className="panel-stack">
            {everlinkSession ? (
              <section className="panel-section">
                <p className="section-kicker">Everlink it!</p>
                <h2>{everlinkSession.mode === "edit" ? "Edit Entity Linkage" : "Create or Extend an Entity"}</h2>
                <p className="section-copy">
                  The current selection stays as clean manuscript text. This flow only creates or extends entity truth and then moves into slice placement.
                </p>
                <div className="selection-card">
                  <strong>Selected text</strong>
                  <span>{truncate(everlinkSession.sourceText, 120)}</span>
                </div>
                <label className="field-stack">
                  <span className="field-label">Attach to existing entity</span>
                  <select
                    className="select-input"
                    value={everlinkSession.selectedEntityId ?? ""}
                    onChange={(event) => setEverlinkSession((current) => current ? {
                      ...current,
                      selectedEntityId: event.target.value || null,
                      mode: event.target.value ? "attach" : "create",
                    } : current)}
                  >
                    <option value="">Create a new entity</option>
                    {(workspace?.entities ?? []).map((entity) => (
                      <option key={entity.id} value={entity.id}>{entity.name}</option>
                    ))}
                  </select>
                </label>
                {everlinkSession.selectedEntityId ? null : (
                  <label className="field-stack">
                    <span className="field-label">New entity name</span>
                    <input
                      className="text-input"
                      value={everlinkSession.entityNameDraft}
                      onChange={(event) => setEverlinkSession((current) => current ? { ...current, entityNameDraft: event.target.value } : current)}
                    />
                  </label>
                )}
                <div className="form-grid">
                  <label className="field-stack">
                    <span className="field-label">Initial rule kind</span>
                    <select
                      className="select-input"
                      value={everlinkSession.ruleKind}
                      onChange={(event) => setEverlinkSession((current) => current ? { ...current, ruleKind: event.target.value as MatchingRuleKind } : current)}
                    >
                      <option value="literal">Literal</option>
                      <option value="alias">Alias</option>
                      <option value="regex">Regex</option>
                    </select>
                  </label>
                  <label className="field-stack">
                    <span className="field-label">Target document</span>
                    <select
                      className="select-input"
                      value={everlinkSession.targetDocumentId ?? ""}
                      onChange={(event) => setEverlinkSession((current) => current ? { ...current, targetDocumentId: event.target.value } : current)}
                    >
                      {workspace?.layout.recentTargetDocumentIds.map((documentId) => {
                        const document = documentsById.get(documentId);
                        return document ? <option key={document.id} value={document.id}>{document.title}</option> : null;
                      })}
                      {(workspace?.documents ?? []).filter((document) => !workspace.layout.recentTargetDocumentIds.includes(document.id)).map((document) => (
                        <option key={document.id} value={document.id}>{document.title}</option>
                      ))}
                      <option value="__create__">Create new target document...</option>
                    </select>
                  </label>
                </div>
                {everlinkSession.targetDocumentId === "__create__" ? (
                  <div className="toolbar-actions">
                    <input
                      className="text-input"
                      value={everlinkSession.newTargetDocumentTitle}
                      onChange={(event) => setEverlinkSession((current) => current ? { ...current, newTargetDocumentTitle: event.target.value } : current)}
                      placeholder="New target document title"
                    />
                    <button className="ghost-button" onClick={() => void handleCreateTargetDocumentFromChooser()} type="button">
                      Create Target Doc
                    </button>
                  </div>
                ) : null}
                <div className="toolbar-actions">
                  <button className="primary-button" onClick={() => void handleBeginPlacement()} type="button">
                    Continue to Slice Placement
                  </button>
                  <button className="secondary-button" onClick={() => void handleCancelPlacement()} type="button">
                    Cancel
                  </button>
                </div>
              </section>
            ) : null}

            {pendingPlacement ? (
              <section className="panel-section panel-section--grow">
                <p className="section-kicker">Slice Placement</p>
                <h2>Place the slice in the target document</h2>
                <p className="section-copy">
                  Click once to set the slice start, then type, paste, or select the range you want to keep tracked. Empty placements auto-fill from the source selection on commit or blur.
                </p>
                <div className="selection-card">
                  <strong>Source text</strong>
                  <span>{truncate(pendingPlacement.sourceText, 140)}</span>
                </div>
                <div className="selection-card">
                  <strong>Target</strong>
                  <span>{documentsById.get(pendingPlacement.targetDocumentId)?.title ?? "Current document"}</span>
                </div>
                <div className="toolbar-actions">
                  <button className="primary-button" onClick={() => void handleCommitPendingSlice()} type="button">
                    Commit Slice
                  </button>
                  <button className="secondary-button" onClick={() => void handleCancelPlacement()} type="button">
                    Cancel
                  </button>
                </div>
                {pendingPlacement.surface === "panel" ? (
                  <div className="panel-document-view">
                    <HarnessEditor
                      key={panelDocument?.id ?? emptySnapshot.id}
                      ref={panelEditorRef}
                      initialDocumentJson={panelDocument?.contentJson ?? emptySnapshot.contentJson}
                      decorationsEnabled
                      matchingRules={[]}
                      sliceBoundaries={panelVisibleBoundaries}
                      pendingRange={panelPendingRange}
                      legendLabels={{
                        match: "Panel view",
                        boundary: "Slice boundary",
                        pending: "Pending slice",
                      }}
                      onDocumentSnapshotChange={handlePanelSnapshotChange}
                      onSelectionChange={(selection) => handleSelectionChange("panel", selection)}
                      onBlur={() => void handlePanelBlur()}
                    />
                  </div>
                ) : (
                  <p className="panel-note">
                    The current document is the placement surface. Click back into the main editor to set the slice range there, then commit from this panel.
                  </p>
                )}
              </section>
            ) : null}

            {!everlinkSession && !pendingPlacement ? (
              <>
                <section className="panel-section">
                  <p className="section-kicker">Entities</p>
                  <h2>Entity Library</h2>
                  <div className="entity-list">
                    {(workspace?.entities ?? []).length === 0 ? (
                      <div className="stack-list">
                        <p className="empty-state">Start from a story selection with Everlink it!, or create the first entity manually here.</p>
                        <button className="ghost-button" onClick={() => void handleCreateManualEntity()} type="button">
                          Create First Entity
                        </button>
                      </div>
                    ) : (
                      (workspace?.entities ?? []).map((entity) => (
                        <button
                          key={entity.id}
                          className={entity.id === selectedEntity?.id ? "entity-chip entity-chip--active" : "entity-chip"}
                          onClick={() => void handleSelectEntity(entity.id)}
                          type="button"
                        >
                          {entity.name}
                        </button>
                      ))
                    )}
                  </div>
                  {(workspace?.entities ?? []).length > 0 ? (
                    <button className="ghost-button" onClick={() => void handleCreateManualEntity()} type="button">
                      New Entity
                    </button>
                  ) : null}
                </section>

                {selectedEntity ? (
                  <>
                    <section className="panel-section">
                      <p className="section-kicker">Entity Detail</p>
                      <input
                        className="text-input"
                        value={entityNameDraft}
                        onChange={(event) => setEntityNameDraft(event.target.value)}
                        onBlur={() => void handleSaveEntityName()}
                      />
                      <div className="toolbar-actions">
                        <button className="ghost-button ghost-button--danger" onClick={() => void handleDeleteEntity()} type="button">
                          Delete Entity
                        </button>
                      </div>
                    </section>

                    <section className="panel-section">
                      <p className="section-kicker">Matching Rules</p>
                      <div className="form-grid form-grid--stack">
                        <input
                          className="text-input"
                          value={ruleForm.label}
                          onChange={(event) => setRuleForm((current) => ({ ...current, label: event.target.value }))}
                          placeholder="Rule label"
                        />
                        <input
                          className="text-input"
                          value={ruleForm.pattern}
                          onChange={(event) => setRuleForm((current) => ({ ...current, pattern: event.target.value }))}
                          placeholder="Pattern"
                        />
                        <div className="toolbar-actions">
                          <select
                            className="select-input"
                            value={ruleForm.kind}
                            onChange={(event) => setRuleForm((current) => ({ ...current, kind: event.target.value as MatchingRuleKind }))}
                          >
                            <option value="literal">Literal</option>
                            <option value="alias">Alias</option>
                            <option value="regex">Regex</option>
                          </select>
                          <label className="checkbox-row">
                            <input
                              checked={ruleForm.wholeWord}
                              onChange={(event) => setRuleForm((current) => ({ ...current, wholeWord: event.target.checked }))}
                              type="checkbox"
                            />
                            Whole word
                          </label>
                          <label className="checkbox-row">
                            <input
                              checked={ruleForm.allowPossessive}
                              onChange={(event) => setRuleForm((current) => ({ ...current, allowPossessive: event.target.checked }))}
                              type="checkbox"
                            />
                            Allow possessive
                          </label>
                          <button className="ghost-button" onClick={() => void handleCreateEntityRule()} type="button">
                            Add Rule
                          </button>
                        </div>
                      </div>
                      <div className="stack-list">
                        {selectedEntityRules.length === 0 ? (
                          <p className="empty-state">This entity does not have any rules yet.</p>
                        ) : (
                          selectedEntityRules.map((rule) => (
                            <article key={rule.id} className="stack-card">
                              <div className="stack-card__meta">
                                <strong>{rule.label}</strong>
                                <span>{rule.kind}</span>
                              </div>
                              <p className="stack-card__copy">{rule.pattern}</p>
                              <div className="toolbar-actions">
                                <button className="ghost-button" onClick={() => void handleToggleRule(rule)} type="button">
                                  {rule.enabled ? "Disable" : "Enable"}
                                </button>
                                <button className="ghost-button ghost-button--danger" onClick={() => void handleDeleteRule(rule.id)} type="button">
                                  Delete
                                </button>
                              </div>
                            </article>
                          ))
                        )}
                      </div>
                    </section>

                    <section className="panel-section panel-section--grow">
                      <p className="section-kicker">Slices</p>
                      <h2>Slice Viewer</h2>
                      <div className="stack-list">
                        {selectedEntitySlices.length === 0 ? (
                          <p className="empty-state">No slices linked yet. Use Everlink it! to place the first one.</p>
                        ) : (
                          selectedEntitySlices.map(({ slice, boundary, document }) => (
                            <article key={slice.id} className={`stack-card ${boundary ? `stack-card--${boundary.resolution.status}` : "stack-card--neutral"}`}>
                              <div className="stack-card__meta">
                                <strong>{slice.title}</strong>
                                <span>{document?.title ?? "Document"}</span>
                              </div>
                              <p className="stack-card__copy">{slice.excerpt}</p>
                              <p className="stack-card__copy">
                                {boundary
                                  ? formatBoundaryReason(boundary.resolution.reason)
                                  : "Boundary record missing"}
                              </p>
                              <div className="toolbar-actions">
                                <button className="ghost-button" onClick={() => void handleOpenSliceInPanel(slice.documentId, selectedEntity.id)} type="button">
                                  Open in Panel
                                </button>
                                <button className="ghost-button ghost-button--danger" onClick={() => void handleDeleteSlice(slice.id)} type="button">
                                  Delete
                                </button>
                              </div>
                            </article>
                          ))
                        )}
                      </div>
                    </section>

                    {panelDocument ? (
                      <section className="panel-section panel-section--grow">
                        <p className="section-kicker">Panel Document View</p>
                        <h2>{panelDocument.title}</h2>
                        <div className="panel-document-view">
                          <HarnessEditor
                            key={panelDocument.id}
                            ref={panelEditorRef}
                            initialDocumentJson={panelDocument.contentJson}
                            decorationsEnabled
                            matchingRules={[]}
                            sliceBoundaries={panelVisibleBoundaries}
                            pendingRange={null}
                            legendLabels={{
                              match: "Panel view",
                              boundary: "Slice boundary",
                              pending: "Pending slice",
                            }}
                            onDocumentSnapshotChange={handlePanelSnapshotChange}
                            onSelectionChange={(selection) => handleSelectionChange("panel", selection)}
                          />
                        </div>
                      </section>
                    ) : null}
                  </>
                ) : null}
              </>
            ) : null}

            <section className="panel-section">
              <p className="section-kicker">Run Log</p>
              <div className="run-log">
                {runLog.length === 0 ? (
                  <p className="empty-state">Workspace events will show up here as you open docs, Everlink selections, and place slices.</p>
                ) : (
                  runLog.map((entry) => (
                    <article key={entry.id} className={`run-log-entry run-log-entry--${entry.tone}`}>
                      <div className="run-log-meta">
                        <span>{entry.createdAt}</span>
                        <span>{entry.tone}</span>
                      </div>
                      <p>{entry.message}</p>
                    </article>
                  ))
                )}
              </div>
            </section>
          </aside>
        ) : null}
      </main>

      {hoverPreview && hoverEntity ? (
        <div className="hover-preview" style={{ left: hoverPreview.x + 18, top: hoverPreview.y + 18 }}>
          <p className="section-kicker">Preview</p>
          <h3>{hoverEntity.name}</h3>
          <div className="stack-list">
            {hoverSlices.length === 0 ? (
              <p className="empty-state">No linked slices yet.</p>
            ) : (
              hoverSlices.slice(0, 3).map(({ slice, boundary, document }) => (
                <article key={slice.id} className="stack-card stack-card--neutral">
                  <div className="stack-card__meta">
                    <strong>{slice.title}</strong>
                    <span>{document?.title ?? "Document"}</span>
                  </div>
                  <p className="stack-card__copy">{slice.excerpt}</p>
                  {boundary ? <p className="stack-card__copy">{formatBoundaryReason(boundary.resolution.reason)}</p> : null}
                </article>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function getActiveProject(workspace: WorkspaceState | null): ReturnType<typeof findProject> {
  if (!workspace) {
    return null;
  }
  return findProject(workspace.projects, workspace.layout.activeProjectId);
}

function findProject(projects: WorkspaceState["projects"], projectId: string | null) {
  return projectId ? projects.find((project) => project.id === projectId) ?? null : null;
}

function getSelectedEntity(workspace: WorkspaceState | null): EntityRecord | null {
  if (!workspace || !workspace.layout.selectedEntityId) {
    return null;
  }
  return workspace.entities.find((entity) => entity.id === workspace.layout.selectedEntityId) ?? null;
}

function selectedSlicesForEntity(
  entityId: string,
  workspace: WorkspaceState | null,
  slicesById: Map<string, SliceRecord>,
  boundariesBySliceId: Map<string, SliceBoundaryRecord>,
  documentsById: Map<string, DocumentSummary>,
) {
  if (!workspace) {
    return [] as Array<{ slice: SliceRecord; boundary: SliceBoundaryRecord | undefined; document: DocumentSummary | undefined }>;
  }

  return workspace.entitySlices
    .filter((link) => link.entityId === entityId)
    .sort((left, right) => left.ordering - right.ordering)
    .flatMap((link) => {
      const slice = slicesById.get(link.sliceId);
      if (!slice) {
        return [];
      }
      return [{
        slice,
        boundary: boundariesBySliceId.get(slice.id),
        document: documentsById.get(slice.documentId),
      }];
    });
}

function groupDocumentsByFolder(documents: DocumentSummary[]): Map<string | null, DocumentSummary[]> {
  const grouped = new Map<string | null, DocumentSummary[]>();
  for (const document of documents) {
    const key = document.folderId;
    const bucket = grouped.get(key) ?? [];
    bucket.push(document);
    grouped.set(key, bucket);
  }

  for (const [key, bucket] of grouped.entries()) {
    grouped.set(key, [...bucket].sort((left, right) => left.ordering - right.ordering));
  }

  return grouped;
}

function MetricCard(props: { label: string; value: string }) {
  return (
    <article className="metric-card">
      <span className="metric-label">{props.label}</span>
      <strong className="metric-value">{props.value}</strong>
    </article>
  );
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatBoundaryReason(reason: string): string {
  if (reason.includes("absorbed edits inside")) {
    return "The slice boundary stayed intact while text inside it changed.";
  }
  if (reason.includes("mapped forward")) {
    return "The slice boundary followed later edits cleanly.";
  }
  if (reason.includes("multiple plausible matches")) {
    return "The boundary failed closed because multiple plausible matches remained.";
  }
  if (reason.includes("exact text no longer exists")) {
    return "The exact boundary text no longer exists in the document.";
  }
  if (reason.includes("exact text plus context repaired")) {
    return "The boundary repaired from exact text plus nearby context.";
  }
  return reason;
}

function countForLabel(currentCount: number): number {
  return currentCount + 1;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

function stringifyError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
