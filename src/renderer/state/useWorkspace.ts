// The workspace hook — owns persisted state, the mutation queue, and
// document persistence debouncing. Every feature component reads
// `workspace` and calls `runMutation` / `queueDocumentPersistence`. It
// is the only thing in the renderer that talks to `window.evernear`.

import { useCallback, useEffect, useRef, useState } from "react";

import type {
  ApplyDocumentTransactionResult,
  WorkspaceState,
  WorkspaceStatus,
} from "../../shared/domain/workspace";
import type { HarnessEditorSnapshot } from "../editor/HarnessEditor";
import type { SerializedTransactionBundle } from "../editor/editorUtils";
import { stringifyError } from "../utils/formatting";
import type { RunLogEntry, RunLogTone } from "./sessionTypes";

export type WorkspaceHook = {
  status: WorkspaceStatus | null;
  workspace: WorkspaceState | null;
  pendingWrites: number;
  isBusy: boolean;
  runLog: RunLogEntry[];
  // For UI components that want to surface a message — and for hook callers
  // that want to complete a multi-step flow with their own log entry.
  appendLog: (message: string, tone: RunLogTone) => void;
  // Returns the latest WorkspaceState for callers that need to branch on
  // the fresh read (e.g. the everlink flow needs the id of a newly-created
  // document before committing a slice).
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
  const persistenceQueueRef = useRef<Promise<void>>(Promise.resolve());
  const documentVersionsRef = useRef(new Map<string, number>());
  const commitInFlightRef = useRef(false);

  const [status, setStatus] = useState<WorkspaceStatus | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceState | null>(null);
  const [pendingWrites, setPendingWrites] = useState(0);
  const [isBusy, setIsBusy] = useState(false);
  const [runLog, setRunLog] = useState<RunLogEntry[]>([]);

  const appendLog = useCallback((message: string, tone: RunLogTone) => {
    setRunLog((current) => [
      { id: current.length + 1, message, tone, createdAt: new Date().toLocaleTimeString() },
      ...current,
    ].slice(0, 30));
  }, []);

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
      appendLog(message, "success");
    }
  }, [appendLog]);

  const flushPersistence = useCallback(async () => {
    await persistenceQueueRef.current.catch(() => undefined);
  }, []);

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
      appendLog(stringifyError(error), "warn");
    } finally {
      setIsBusy(false);
    }
  }, [flushPersistence, applyWorkspace, appendLog]);

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

  const queueDocumentPersistence = useCallback((
    documentId: string,
    title: string,
    snapshot: HarnessEditorSnapshot,
    transaction: SerializedTransactionBundle,
  ) => {
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
  }, [patchWorkspaceDocument, appendLog]);

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
        applyWorkspace(nextWorkspace, "Workspace opened against the persisted project store.");
      } catch (error) {
        if (cancelled) return;
        appendLog(`Failed to initialize Evernear: ${stringifyError(error)}`, "warn");
      } finally {
        if (!cancelled) setIsBusy(false);
      }
    }
    void initialize();
    return () => {
      cancelled = true;
    };
  }, [appendLog, applyWorkspace]);

  return {
    status,
    workspace,
    pendingWrites,
    isBusy,
    runLog,
    appendLog,
    applyWorkspace,
    runMutation,
    flushPersistence,
    queueDocumentPersistence,
    setBusy: setIsBusy,
    workspaceRef,
    commitInFlightRef,
  };
}
