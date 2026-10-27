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
import { patternMatchesWholeText } from "../../shared/matchingPatterns";
import type { EditorMatchingRule } from "../editor/editorUtils";

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

// The entity one of whose enabled rules matches all of `text`, if any.
export function entityMatchingText(
  rules: EditorMatchingRule[],
  text: string,
): { id: string; name: string } | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const rule = rules.find((candidate) =>
    candidate.enabled && candidate.regex !== null && patternMatchesWholeText(candidate.regex, trimmed));
  return rule ? { id: rule.entityId, name: rule.entityName } : null;
}

export type SliceEditingSummary = {
  focused: { sliceId: string; entityNames: string[] } | null;
  // Slices in this document whose text can't be found, oldest first.
  lost: Array<{ sliceId: string; text: string }>;
};

export function sliceEditingSummary(
  workspace: WorkspaceState | null,
  documentId: string | null,
  focusedSliceId: string | null,
  entitiesById: Map<string, EntityRecord>,
): SliceEditingSummary {
  if (!workspace || !documentId) return { focused: null, lost: [] };

  const focused = focusedSliceId && workspace.slices.some((slice) => slice.id === focusedSliceId)
    ? {
        sliceId: focusedSliceId,
        entityNames: workspace.entitySlices
          .filter((link) => link.sliceId === focusedSliceId)
          .map((link) => entitiesById.get(link.entityId)?.name ?? "Entity"),
      }
    : null;

  const lost = workspace.sliceBoundaries
    .filter((boundary) => boundary.documentId === documentId
      && (boundary.resolution.status === "invalid" || boundary.resolution.status === "ambiguous"))
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .map((boundary) => ({ sliceId: boundary.sliceId, text: boundary.anchor.exact }));

  return { focused, lost };
}
