// Shared re-anchoring helpers used by both Everlink's placement commit
// (usePendingPlacement) and Everslice's direct commit (useEverslicePlacement).
//
// The invariant both callers preserve: the editor snapshot's contentJson
// and the from/to positions must come from the same source of truth. The
// persisted document's currentVersion is what the resolver will start from
// when later mapping the anchor through subsequent edits. Reading contentJson
// from the DB while start/end came from the editor was the previous race
// window — any keystroke between flushPersistence and createSlice would
// leave the snapshot out of sync with positions, producing mismatched
// exact/prefix/suffix and a stale versionSeen.

import type { MutableRefObject } from "react";

import type { StoredDocumentSnapshot } from "../../shared/domain/document";
import type { WorkspaceState } from "../../shared/domain/workspace";
import type { HarnessEditorHandle } from "../editor/HarnessEditor";
import { buildTextAnchorFromSelection } from "../editor/editorUtils";
import { stringifyError, truncate } from "../utils/formatting";
import type { RunLogTone } from "./sessionTypes";

export function resolveAnchorSnapshot(
  editor: HarnessEditorHandle,
  targetDoc: StoredDocumentSnapshot,
): StoredDocumentSnapshot {
  const editorSnapshot = editor.getSnapshot();
  return {
    id: targetDoc.id,
    title: targetDoc.title,
    contentFormat: targetDoc.contentFormat,
    contentSchemaVersion: targetDoc.contentSchemaVersion,
    contentJson: editorSnapshot.contentJson,
    plainText: editorSnapshot.plainText,
    currentVersion: targetDoc.currentVersion,
    updatedAt: targetDoc.updatedAt,
  };
}

export type CommitSliceWithFreshAnchorOptions = {
  editor: HarnessEditorHandle;
  projectId: string;
  entityId: string;
  targetDocumentId: string;
  sourceText: string;
  start: number;
  end: number;
  workspaceRef: MutableRefObject<WorkspaceState | null>;
  flushPersistence: () => Promise<void>;
  applyWorkspace: (next: WorkspaceState, message?: string) => void;
  appendLog: (message: string, tone: RunLogTone) => void;
  setBusy: (busy: boolean) => void;
  commitInFlightRef: MutableRefObject<boolean>;
};

export async function commitSliceWithFreshAnchor(
  options: CommitSliceWithFreshAnchorOptions,
): Promise<boolean> {
  const {
    editor,
    projectId,
    entityId,
    targetDocumentId,
    sourceText,
    start,
    end,
    workspaceRef,
    flushPersistence,
    applyWorkspace,
    appendLog,
    setBusy,
    commitInFlightRef,
  } = options;

  if (commitInFlightRef.current) return false;

  setBusy(true);
  commitInFlightRef.current = true;

  try {
    await flushPersistence();

    const ws = workspaceRef.current;
    const targetDoc = ws?.activeDocument?.id === targetDocumentId
      ? ws.activeDocument
      : ws?.panelDocument?.id === targetDocumentId
        ? ws.panelDocument
        : null;

    if (!targetDoc) {
      throw new Error("Could not find the target document for slice placement.");
    }

    const anchorSnapshot = resolveAnchorSnapshot(editor, targetDoc);

    const anchor = buildTextAnchorFromSelection(anchorSnapshot, {
      from: Math.min(start, end),
      to: Math.max(start, end),
      empty: false,
      text: sourceText,
    });

    if (!anchor) {
      throw new Error("Could not build an anchored slice range from the committed placement.");
    }

    const nextWorkspace = await window.evernear.createSlice({
      projectId,
      entityId,
      documentId: targetDocumentId,
      title: truncate(sourceText.trim(), 42),
      anchor,
    });
    applyWorkspace(nextWorkspace, "Committed the slice and linked it to the selected entity.");
    return true;
  } catch (error) {
    appendLog(`Slice placement failed: ${stringifyError(error)}`, "warn");
    return false;
  } finally {
    commitInFlightRef.current = false;
    setBusy(false);
  }
}
