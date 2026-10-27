// Serial save queue for editor transactions. Each queued write waits for
// the previous one so `baseVersion` always matches what the database last
// accepted for that document.

import { useCallback, useRef, useState } from "react";
import type { MutableRefObject } from "react";

import type { ApplyDocumentTransactionResult } from "../../shared/domain/workspace";
import type { HarnessEditorSnapshot } from "../editor/HarnessEditor";
import type { SerializedTransactionBundle } from "../editor/editorUtils";
import { stringifyError } from "../utils/formatting";

type UseDocumentPersistenceInput = {
  documentVersionsRef: MutableRefObject<Map<string, number>>;
  onPersisted: (result: ApplyDocumentTransactionResult) => void;
  onFailed: (message: string) => void;
};

export type DocumentPersistence = {
  pendingWrites: number;
  flushPersistence: () => Promise<void>;
  queueDocumentPersistence: (
    documentId: string,
    title: string,
    snapshot: HarnessEditorSnapshot,
    transaction: SerializedTransactionBundle,
  ) => void;
};

export function useDocumentPersistence(input: UseDocumentPersistenceInput): DocumentPersistence {
  const { documentVersionsRef, onPersisted, onFailed } = input;
  const persistenceQueueRef = useRef<Promise<void>>(Promise.resolve());
  const [pendingWrites, setPendingWrites] = useState(0);

  const flushPersistence = useCallback(async () => {
    await persistenceQueueRef.current.catch(() => undefined);
  }, []);

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
        onPersisted(result);
      })
      .catch((error) => {
        onFailed(`Document persistence drifted: ${stringifyError(error)}`);
      })
      .finally(() => {
        setPendingWrites((current) => Math.max(0, current - 1));
      });
  }, [documentVersionsRef, onPersisted, onFailed]);

  return { pendingWrites, flushPersistence, queueDocumentPersistence };
}
