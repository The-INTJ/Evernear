// Pure read helpers over WorkspaceState. No React, no IPC — these are
// the kind of derived lookups that would bloat a custom hook's body if
// left inline. Anything that needs workspace-specific arithmetic and
// doesn't need React state belongs here.

import type {
  DocumentSummary,
  EntityRecord,
  ProjectRecord,
  SliceBoundaryRecord,
  SliceRecord,
  WorkspaceState,
} from "../../shared/domain/workspace";

export function getActiveProject(workspace: WorkspaceState | null): ProjectRecord | null {
  if (!workspace) return null;
  return findProject(workspace.projects, workspace.layout.activeProjectId);
}

export function findProject(
  projects: WorkspaceState["projects"],
  projectId: string | null,
): ProjectRecord | null {
  return projects.find((project) => project.id === projectId) ?? null;
}

export function getSelectedEntity(workspace: WorkspaceState | null): EntityRecord | null {
  if (!workspace) return null;
  return workspace.entities.find((entity) => entity.id === workspace.layout.selectedEntityId) ?? null;
}

export type ResolvedSliceView = {
  slice: SliceRecord;
  boundary: SliceBoundaryRecord | undefined;
  document: DocumentSummary | undefined;
};

export function selectedSlicesForEntity(
  entityId: string,
  workspace: WorkspaceState | null,
  slicesById: Map<string, SliceRecord>,
  boundariesBySliceId: Map<string, SliceBoundaryRecord>,
  documentsById: Map<string, DocumentSummary>,
): ResolvedSliceView[] {
  if (!workspace) {
    return [];
  }
  return workspace.entitySlices
    .filter((link) => link.entityId === entityId)
    .sort((left, right) => left.ordering - right.ordering)
    .flatMap((link) => {
      const slice = slicesById.get(link.sliceId);
      if (!slice) return [];
      return [{
        slice,
        boundary: boundariesBySliceId.get(slice.id),
        document: documentsById.get(slice.documentId),
      }];
    });
}

