// Pure row-to-domain decoders. No DB access, no mutation.
// Colocated here so the shape of "what SQLite gives us" is decoded to
// "what the rest of the app sees" in exactly one place per entity.

import {
  collectDocumentMetrics,
  type JsonObject,
  type StoredDocumentSnapshot,
} from "../shared/domain/document";
import {
  DEFAULT_PROJECT_ID,
  type AnchorResolutionResult,
  type DocumentFolderRecord,
  type DocumentSummary,
  type EntityRecord,
  type EntitySliceRecord,
  type MatchingRuleRecord,
  type ProjectRecord,
  type PaneContent,
  type PanePlacement,
  type SliceBoundaryRecord,
  type SliceRecord,
  type TextAnchor,
  type WorkspacePane,
} from "../shared/domain/workspace";
import { intToBool } from "./utils";
import type {
  RawDocumentRow,
  RawEntityRow,
  RawEntitySliceRow,
  RawFolderRow,
  RawMatchingRuleRow,
  RawProjectRow,
  RawSliceBoundaryRow,
  RawSliceRow,
  RawWorkspacePaneRow,
} from "./rowTypes";

export function mapProjectRow(row: RawProjectRow): ProjectRecord {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapFolderRow(row: RawFolderRow): DocumentFolderRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    parentFolderId: row.parent_folder_id,
    title: row.title,
    ordering: row.ordering,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapDocumentSummary(row: RawDocumentRow): DocumentSummary {
  const metrics = collectDocumentMetrics(row.plain_text);
  return {
    id: row.id,
    projectId: row.project_id ?? DEFAULT_PROJECT_ID,
    folderId: row.folder_id,
    title: row.title,
    ordering: row.ordering,
    wordCount: metrics.wordCount,
    characterCount: metrics.characterCount,
    paragraphCount: metrics.paragraphCount,
    createdAt: row.created_at ?? row.updated_at,
    updatedAt: row.updated_at,
  };
}

export function mapDocumentSnapshot(row: RawDocumentRow): StoredDocumentSnapshot {
  return {
    id: row.id,
    title: row.title,
    contentFormat: row.content_format,
    contentSchemaVersion: row.content_schema_version,
    contentJson: JSON.parse(row.content_json) as StoredDocumentSnapshot["contentJson"],
    plainText: row.plain_text,
    currentVersion: row.current_version,
    updatedAt: row.updated_at,
  };
}

export function mapEntityRow(row: RawEntityRow): EntityRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapMatchingRuleRow(row: RawMatchingRuleRow): MatchingRuleRecord | null {
  if (!row.entity_id) {
    return null;
  }
  return {
    id: row.id,
    entityId: row.entity_id,
    label: row.label,
    kind: row.kind as MatchingRuleRecord["kind"],
    pattern: row.pattern,
    wholeWord: intToBool(row.whole_word),
    allowPossessive: intToBool(row.allow_possessive),
    enabled: intToBool(row.enabled),
    createdAt: row.created_at ?? row.updated_at,
    updatedAt: row.updated_at,
  };
}

export function mapSliceRow(row: RawSliceRow): SliceRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    documentId: row.document_id,
    boundaryId: row.boundary_id,
    title: row.title,
    excerpt: row.excerpt,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapSliceBoundaryRow(row: RawSliceBoundaryRow): SliceBoundaryRecord {
  return {
    id: row.id,
    sliceId: row.slice_id,
    documentId: row.document_id,
    anchor: JSON.parse(row.anchor_json) as TextAnchor,
    resolution: {
      status: row.resolution_status as AnchorResolutionResult["status"],
      reason: row.resolution_reason,
      anchor: JSON.parse(row.anchor_json) as TextAnchor,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapEntitySliceRow(row: RawEntitySliceRow): EntitySliceRecord {
  return {
    entityId: row.entity_id,
    sliceId: row.slice_id,
    ordering: row.ordering,
  };
}

export function mapWorkspacePaneRow(row: RawWorkspacePaneRow): WorkspacePane {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    content: JSON.parse(row.content_json) as PaneContent,
    placement: JSON.parse(row.placement_json) as PanePlacement,
    history: JSON.parse(row.history_json) as PaneContent[],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function buildEmptyDocumentJson(): JsonObject {
  return {
    type: "doc",
    content: [{ type: "paragraph" }],
  };
}
