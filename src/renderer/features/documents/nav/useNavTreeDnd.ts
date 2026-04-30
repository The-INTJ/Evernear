// Glue between @dnd-kit/core and the workspace move IPCs.
//
// Drag id encoding:   drag:<kind>:<id>           where kind = folder | doc
// Drop id encoding:   dropzone:<zone>:<targetKind>:<targetId>
//                     zone       = above | onto | below
//                     targetKind = folder | doc | unfiled
//                     targetId   = folder/doc id, or "root" for unfiled
//
// Three sub-droppables per row let dnd-kit do the zone math via its
// own collision detection — no manual pointer-Y arithmetic. Folders
// expose all three zones; documents only above/below; the unfiled
// pseudo-section exposes only "onto".

import { useCallback, useEffect, useRef, useState } from "react";
import type { DragEndEvent, DragOverEvent, DragStartEvent } from "@dnd-kit/core";

import type { NavTreeStructure } from "./useNavTreeStructure";

const AUTO_EXPAND_DELAY_MS = 500;

type DragSource =
  | { kind: "folder"; id: string }
  | { kind: "doc"; id: string };

type DropZone = "above" | "onto" | "below";
type DropTargetKind = "folder" | "doc" | "unfiled";

type DropTarget = {
  zone: DropZone;
  kind: DropTargetKind;
  // null means the unfiled root section
  id: string | null;
};

type Args = {
  structure: NavTreeStructure;
  expandedFolderIds: string[];
  onToggleFolder: (folderId: string) => void;
  onMoveFolder: (folderId: string, newParentFolderId: string | null, beforeFolderId: string | null) => void;
  onMoveDocument: (documentId: string, newFolderId: string | null, beforeDocumentId: string | null) => void;
};

export function useNavTreeDnd(args: Args) {
  const { structure, expandedFolderIds, onToggleFolder, onMoveFolder, onMoveDocument } = args;
  const [activeDrag, setActiveDrag] = useState<DragSource | null>(null);
  const [hoverTarget, setHoverTarget] = useState<DropTarget | null>(null);
  const expandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expandedSetRef = useRef(new Set(expandedFolderIds));
  expandedSetRef.current = new Set(expandedFolderIds);

  const clearExpandTimer = () => {
    if (expandTimerRef.current !== null) {
      clearTimeout(expandTimerRef.current);
      expandTimerRef.current = null;
    }
  };

  useEffect(() => () => clearExpandTimer(), []);

  // Auto-expand a collapsed folder after a short hover. Mirrors the
  // VS Code / Finder behavior so users can drop deep without manually
  // expanding every level first.
  useEffect(() => {
    clearExpandTimer();
    if (!hoverTarget) return;
    if (hoverTarget.kind !== "folder" || hoverTarget.id === null) return;
    if (expandedSetRef.current.has(hoverTarget.id)) return;
    const folderId = hoverTarget.id;
    expandTimerRef.current = setTimeout(() => {
      onToggleFolder(folderId);
    }, AUTO_EXPAND_DELAY_MS);
  }, [hoverTarget, onToggleFolder]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const parsed = parseDragId(String(event.active.id));
    if (!parsed) {
      setActiveDrag(null);
      return;
    }
    setActiveDrag(parsed);
    setHoverTarget(null);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    if (!event.over) {
      setHoverTarget(null);
      return;
    }
    const parsed = parseDropZoneId(String(event.over.id));
    if (!parsed) {
      setHoverTarget(null);
      return;
    }
    setHoverTarget(parsed);
  }, []);

  const handleDragCancel = useCallback(() => {
    setActiveDrag(null);
    setHoverTarget(null);
    clearExpandTimer();
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    clearExpandTimer();
    const source = parseDragId(String(event.active.id));
    const target = event.over ? parseDropZoneId(String(event.over.id)) : null;
    setActiveDrag(null);
    setHoverTarget(null);
    if (!source || !target) return;
    if (!isDropAllowed(source, target, structure)) return;
    applyDrop(source, target, structure, onMoveFolder, onMoveDocument);
  }, [structure, onMoveFolder, onMoveDocument]);

  return {
    activeDrag,
    hoverTarget,
    handleDragStart,
    handleDragOver,
    handleDragCancel,
    handleDragEnd,
  };
}

// ──────────────── id encoding ────────────────

export function buildDragId(kind: "folder" | "doc", id: string): string {
  return `drag:${kind}:${id}`;
}

export function buildDropZoneId(zone: DropZone, kind: DropTargetKind, id: string | null): string {
  return `dropzone:${zone}:${kind}:${id ?? "root"}`;
}

function parseDragId(raw: string): DragSource | null {
  const parts = raw.split(":");
  if (parts.length !== 3 || parts[0] !== "drag") return null;
  const kind = parts[1];
  const id = parts[2];
  if (kind !== "folder" && kind !== "doc") return null;
  if (!id) return null;
  return { kind, id };
}

function parseDropZoneId(raw: string): DropTarget | null {
  const parts = raw.split(":");
  if (parts.length !== 4 || parts[0] !== "dropzone") return null;
  const zone = parts[1];
  const kind = parts[2];
  const rawId = parts[3];
  if (zone !== "above" && zone !== "onto" && zone !== "below") return null;
  if (kind !== "folder" && kind !== "doc" && kind !== "unfiled") return null;
  const id = rawId === "root" ? null : rawId;
  return { zone, kind, id };
}

// ──────────────── validation + dispatch ────────────────

function isDropAllowed(
  source: DragSource,
  target: DropTarget,
  structure: NavTreeStructure,
): boolean {
  // No-op drop on self.
  if (source.kind === "folder" && target.kind === "folder" && source.id === target.id) {
    return false;
  }
  if (source.kind === "doc" && target.kind === "doc" && source.id === target.id) {
    return false;
  }

  // Folders can't drop into themselves or their descendants — server
  // re-validates, but disabling client-side avoids the round-trip + toast.
  if (source.kind === "folder" && target.kind === "folder" && target.id !== null) {
    const descendants = structure.descendantsByFolderId.get(source.id);
    if (descendants && descendants.has(target.id)) return false;
  }

  // Documents can't be dropped onto another document (only above/below).
  if (target.kind === "doc" && target.zone === "onto") return false;

  // Folders can only land in a folder slot — not above/below a single
  // document or onto an unfiled drop zone (the "unfiled" pseudo-folder
  // is doc-only since it represents the documents-without-a-folder bucket).
  if (source.kind === "folder" && target.kind === "doc") return false;
  if (source.kind === "folder" && target.kind === "unfiled") return false;

  return true;
}

function applyDrop(
  source: DragSource,
  target: DropTarget,
  structure: NavTreeStructure,
  onMoveFolder: Args["onMoveFolder"],
  onMoveDocument: Args["onMoveDocument"],
): void {
  if (source.kind === "folder") {
    const dest = resolveFolderDestination(target, structure);
    if (!dest) return;
    onMoveFolder(source.id, dest.parentFolderId, dest.beforeFolderId);
    return;
  }

  const dest = resolveDocumentDestination(target, structure);
  if (!dest) return;
  onMoveDocument(source.id, dest.folderId, dest.beforeDocumentId);
}

function resolveFolderDestination(
  target: DropTarget,
  structure: NavTreeStructure,
): { parentFolderId: string | null; beforeFolderId: string | null } | null {
  if (target.kind !== "folder") return null;

  if (target.zone === "onto") {
    // Drop into a folder → append at end of its children.
    return { parentFolderId: target.id, beforeFolderId: null };
  }

  // above | below relative to a sibling folder.
  if (target.id === null) return null;
  const targetFolder = structure.foldersById.get(target.id);
  if (!targetFolder) return null;

  const parentFolderId = targetFolder.parentFolderId;
  const siblings = parentFolderId === null
    ? structure.rootFolders
    : structure.childrenByParentId.get(parentFolderId) ?? [];
  const sortedSiblings = [...siblings].sort((a, b) => a.ordering - b.ordering);
  const idx = sortedSiblings.findIndex((s) => s.id === target.id);
  if (idx === -1) return null;

  if (target.zone === "above") {
    return { parentFolderId, beforeFolderId: target.id };
  }
  // below: insert before next sibling, or null (append) if last.
  const next = sortedSiblings[idx + 1];
  return { parentFolderId, beforeFolderId: next ? next.id : null };
}

function resolveDocumentDestination(
  target: DropTarget,
  structure: NavTreeStructure,
): { folderId: string | null; beforeDocumentId: string | null } | null {
  if (target.kind === "folder") {
    if (target.zone === "onto") {
      return { folderId: target.id, beforeDocumentId: null };
    }
    // Document above/below a folder row → land in that folder's parent
    // sibling list as a child document, appended at end. Above means
    // before the folder in display order; since folders and docs render
    // separately within a parent (folders first, then docs), just
    // append docs to the parent.
    if (target.id === null) return null;
    const targetFolder = structure.foldersById.get(target.id);
    if (!targetFolder) return null;
    return { folderId: targetFolder.parentFolderId, beforeDocumentId: null };
  }

  if (target.kind === "unfiled") {
    return { folderId: null, beforeDocumentId: null };
  }

  // target.kind === "doc"
  if (target.id === null) return null;
  const targetDoc = structure.documentsById.get(target.id);
  if (!targetDoc) return null;

  const folderId = targetDoc.folderId;
  const siblings = (structure.documentsByFolderId.get(folderId) ?? [])
    .slice()
    .sort((a, b) => a.ordering - b.ordering);
  const idx = siblings.findIndex((d) => d.id === target.id);
  if (idx === -1) return null;

  if (target.zone === "above") {
    return { folderId, beforeDocumentId: target.id };
  }
  const next = siblings[idx + 1];
  return { folderId, beforeDocumentId: next ? next.id : null };
}
