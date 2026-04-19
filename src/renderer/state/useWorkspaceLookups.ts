// Memoized id-indexed views over WorkspaceState. Feature components reach
// for these rather than rebuilding a Map inside their own render bodies.

import { useMemo } from "react";

import type {
  DocumentSummary,
  EntityRecord,
  SliceBoundaryRecord,
  SliceRecord,
  WorkspaceState,
} from "../../shared/domain/workspace";
import type { EditorMatchingRule } from "../editor/editorUtils";

export type WorkspaceLookups = {
  entitiesById: Map<string, EntityRecord>;
  slicesById: Map<string, SliceRecord>;
  boundariesBySliceId: Map<string, SliceBoundaryRecord>;
  documentsById: Map<string, DocumentSummary>;
  editorRules: EditorMatchingRule[];
};

export function useWorkspaceLookups(workspace: WorkspaceState | null): WorkspaceLookups {
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
    if (!workspace) return [];
    return workspace.matchingRules.map((rule) => ({
      ...rule,
      entityName: entitiesById.get(rule.entityId)?.name ?? "Entity",
    }));
  }, [workspace, entitiesById]);

  return { entitiesById, slicesById, boundariesBySliceId, documentsById, editorRules };
}
