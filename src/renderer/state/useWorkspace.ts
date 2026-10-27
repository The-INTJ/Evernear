// The workspace hook — owns persisted state and the mutation queue, and
// composes the document save queue (useDocumentPersistence). Every feature
// component reads `workspace` and calls `runMutation` /
// `queueDocumentPersistence`.

import { useCallback, useEffect, useRef, useState } from "react";

import type {
  ApplyDocumentTransactionResult,
  WorkspaceState,
  WorkspaceStatus,
} from "../../shared/domain/workspace";
import type { HarnessEditorSnapshot } from "../editor/HarnessEditor";
import type { SerializedTransactionBundle } from "../editor/editorUtils";
import { stringifyError } from "../utils/formatting";
import type { Notice, NoticeTone } from "./sessionTypes";
import { useDocumentPersistence } from "./useDocumentPersistence";

export type WorkspaceHook = {
  status: WorkspaceStatus | null;
  workspace: WorkspaceState | null;
  pendingWrites: number;
  saveError: string | null;
  isBusy: boolean;
  notice: Notice | null;
  dismissNotice: () => void;
  // Only warnings reach the screen; success and info messages are
  // dropped so the window stays quiet.
  notify: (message: string, tone: NoticeTone) => void;
  // Returns the latest WorkspaceState for callers that need to branch on
  // the fresh read (e.g. Add slice needs the id of a newly-created entity
  // before committing the slice).
  applyWorkspace: (next: WorkspaceState, message?: string) => void;
  runMutation: (
    task: () => Promise<WorkspaceState>,
    successMessage?: string,
  ) => Promise<void>;
  flushPersistence: () => Promise<void>;
  queueDocumentPersistence: (
    documentId: string,
    title: string,
    snapshot: HarnessEditorSnapshot,
    transaction: SerializedTransactionBundle,
  ) => void;
  // Lower-level handles kept for the slice-commit flow, which needs to
  // synchronize explicit writes with the persistence queue.
  setBusy: (busy: boolean) => void;
  workspaceRef: React.MutableRefObject<WorkspaceState | null>;
  commitInFlightRef: React.MutableRefObject<boolean>;
};

export function useWorkspace(): WorkspaceHook {
  const workspaceRef = useRef<WorkspaceState | null>(null);
  const documentVersionsRef = useRef(new Map<string, number>());
  const commitInFlightRef = useRef(false);
  const noticeIdRef = useRef(0);

  const [status, setStatus] = useState<WorkspaceStatus | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceState | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const notify = useCallback((message: string, tone: NoticeTone) => {
    if (tone !== "warn") return;
    noticeIdRef.current += 1;
    setNotice({ id: noticeIdRef.current, message, tone });
  }, []);

  const dismissNotice = useCallback(() => setNotice(null), []);

  const applyWorkspace = useCallback((next: WorkspaceState, message?: string) => {
    workspaceRef.current = next;
    setWorkspace(next);
    documentVersionsRef.current.clear();
    if (next.activeDocument) {
      documentVersionsRef.current.set(next.activeDocument.id, next.activeDocument.currentVersion);
    }
    if (next.panelDocument) {
      documentVersionsRef.current.set(next.panelDocument.id, next.panelDocument.currentVersion);
    }
    if (message) {
      notify(message, "success");
    }
  }, [notify]);

  const patchWorkspaceDocument = useCallback((result: ApplyDocumentTransactionResult) => {
    const current = workspaceRef.current;
    if (!current) return;

    const nextDocuments = current.documents.map((document) =>
      document.id === result.summary.id ? result.summary : document);
    const nextBoundaries = [
      ...current.sliceBoundaries.filter((boundary) => boundary.documentId !== result.snapshot.id),
      ...result.sliceBoundaries,
    ];

    applyWorkspace({
      ...current,
      documents: nextDocuments,
      activeDocument: current.activeDocument?.id === result.snapshot.id ? result.snapshot : current.activeDocument,
      panelDocument: current.panelDocument?.id === result.snapshot.id ? result.snapshot : current.panelDocument,
      sliceBoundaries: nextBoundaries,
    });
  }, [applyWorkspace]);

  const reportPersistenceFailure = useCallback((message: string) => {
    notify(message, "warn");
  }, [notify]);

  const { pendingWrites, saveError, flushPersistence, queueDocumentPersistence } = useDocumentPersistence({
    documentVersionsRef,
    onPersisted: patchWorkspaceDocument,
    onFailed: reportPersistenceFailure,
  });

  const runMutation = useCallback(async (
    task: () => Promise<WorkspaceState>,
    successMessage?: string,
  ) => {
    setIsBusy(true);
    try {
      await flushPersistence();
      const next = await task();
      applyWorkspace(next, successMessage);
    } catch (error) {
      notify(stringifyError(error), "warn");
    } finally {
      setIsBusy(false);
    }
  }, [flushPersistence, applyWorkspace, notify]);

  // Kick off the initial load exactly once.
  useEffect(() => {
    let cancelled = false;
    async function initialize(): Promise<void> {
      setIsBusy(true);
      try {
        const [nextStatus, nextWorkspace] = await Promise.all([
          window.evernear.getStatus(),
          window.evernear.loadWorkspace(),
        ]);
        if (cancelled) return;
        setStatus(nextStatus);
        applyWorkspace(nextWorkspace);
      } catch (error) {
        if (cancelled) return;
        notify(`Failed to initialize Evernear: ${stringifyError(error)}`, "warn");
      } finally {
        if (!cancelled) setIsBusy(false);
      }
    }
    void initialize();
    return () => {
      cancelled = true;
    };
  }, [notify, applyWorkspace]);

  return {
    status,
    workspace,
    pendingWrites,
    saveError,
    isBusy,
    notice,
    dismissNotice,
    notify,
    applyWorkspace,
    runMutation,
    flushPersistence,
    queueDocumentPersistence,
    setBusy: setIsBusy,
    workspaceRef,
    commitInFlightRef,
  };
}
