import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { StoredDocumentSnapshot } from "../../shared/domain/document";
import type { EntityRecord, WorkspaceState } from "../../shared/domain/workspace";
import type { HoverPreview as HoverPreviewState } from "./sessionTypes";
import type { WorkspaceActions } from "./useWorkspaceActions";
import type { WorkspaceLookups } from "./useWorkspaceLookups";
import { selectedSlicesForEntity, type ResolvedSliceView } from "../utils/workspace";

const HOVER_PREVIEW_HANDOFF_DELAY_MS = 800;
const HOVER_PREVIEW_EXIT_DELAY_MS = 180;

type UseHoverPreviewInput = {
  actions: WorkspaceActions;
  activeDocument: StoredDocumentSnapshot | null;
  lookups: WorkspaceLookups;
  workspace: WorkspaceState | null;
};

type EditorHoverPayload = {
  entityId: string;
  clientX: number;
  clientY: number;
};

type HoverPreviewHook = {
  clearHoverState: () => void;
  handleEditorHover: (payload: EditorHoverPayload | null) => void;
  handlePinHoverPreview: () => void;
  handlePreviewEnter: () => void;
  handlePreviewLeave: () => void;
  hoverEntity: EntityRecord | null;
  hoverPreview: HoverPreviewState | null;
  hoverSlices: ResolvedSliceView[];
};

export function useHoverPreview({
  actions,
  activeDocument,
  lookups,
  workspace,
}: UseHoverPreviewInput): HoverPreviewHook {
  const [hoverPreview, setHoverPreview] = useState<HoverPreviewState | null>(null);
  const hoverCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverPreviewPointerInsideRef = useRef(false);

  const hoverEntity = hoverPreview
    ? (lookups.entitiesById.get(hoverPreview.entityId) ?? null)
    : null;
  const hoverSlices = useMemo(
    () =>
      hoverPreview && hoverEntity
        ? selectedSlicesForEntity(
            hoverPreview.entityId,
            workspace,
            lookups.slicesById,
            lookups.boundariesBySliceId,
            lookups.documentsById,
          )
        : [],
    [
      hoverEntity,
      hoverPreview,
      lookups.boundariesBySliceId,
      lookups.documentsById,
      lookups.slicesById,
      workspace,
    ],
  );

  const clearHoverCloseTimeout = useCallback(() => {
    if (hoverCloseTimeoutRef.current !== null) {
      clearTimeout(hoverCloseTimeoutRef.current);
      hoverCloseTimeoutRef.current = null;
    }
  }, []);

  const scheduleHoverPreviewClose = useCallback(
    (delayMs: number) => {
      clearHoverCloseTimeout();
      hoverCloseTimeoutRef.current = setTimeout(() => {
        if (!hoverPreviewPointerInsideRef.current) {
          setHoverPreview(null);
        }
        hoverCloseTimeoutRef.current = null;
      }, delayMs);
    },
    [clearHoverCloseTimeout],
  );

  useEffect(() => clearHoverCloseTimeout, [clearHoverCloseTimeout]);

  const handleEditorHover = useCallback(
    (payload: EditorHoverPayload | null) => {
      if (!payload) {
        scheduleHoverPreviewClose(HOVER_PREVIEW_HANDOFF_DELAY_MS);
        return;
      }
      hoverPreviewPointerInsideRef.current = false;
      clearHoverCloseTimeout();
      setHoverPreview((current) => {
        if (current?.entityId === payload.entityId) {
          return current;
        }
        return { entityId: payload.entityId, x: payload.clientX, y: payload.clientY };
      });
    },
    [clearHoverCloseTimeout, scheduleHoverPreviewClose],
  );

  const handlePreviewEnter = useCallback(() => {
    hoverPreviewPointerInsideRef.current = true;
    clearHoverCloseTimeout();
  }, [clearHoverCloseTimeout]);

  const handlePreviewLeave = useCallback(() => {
    hoverPreviewPointerInsideRef.current = false;
    scheduleHoverPreviewClose(HOVER_PREVIEW_EXIT_DELAY_MS);
  }, [scheduleHoverPreviewClose]);

  const handlePinHoverPreview = useCallback(() => {
    if (!hoverPreview || !hoverEntity) return;
    const firstSlice = hoverSlices[0];
    const targetDocumentId =
      firstSlice?.boundary?.documentId ?? firstSlice?.document?.id ?? activeDocument?.id ?? null;
    if (targetDocumentId) {
      actions.openSliceInPanel(targetDocumentId, hoverEntity.id);
    } else {
      actions.selectEntity(hoverEntity.id);
    }
    hoverPreviewPointerInsideRef.current = false;
    clearHoverCloseTimeout();
    setHoverPreview(null);
  }, [actions, activeDocument, clearHoverCloseTimeout, hoverEntity, hoverPreview, hoverSlices]);

  const clearHoverState = useCallback(() => {
    hoverPreviewPointerInsideRef.current = false;
    clearHoverCloseTimeout();
    setHoverPreview(null);
  }, [clearHoverCloseTimeout]);

  return {
    clearHoverState,
    handleEditorHover,
    handlePinHoverPreview,
    handlePreviewEnter,
    handlePreviewLeave,
    hoverEntity,
    hoverPreview,
    hoverSlices,
  };
}
