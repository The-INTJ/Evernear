// Snake-case row shapes as they exist in SQLite. These types never leave
// src/db/ — everything above the repository layer sees the camelCase
// domain shapes declared in src/shared/domain/*. If you need a new column,
// add it here and in src/db/rowMappers.ts together.

export type RawProjectRow = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export type RawFolderRow = {
  id: string;
  project_id: string;
  parent_folder_id: string | null;
  title: string;
  ordering: number;
  created_at: string;
  updated_at: string;
};

export type RawDocumentRow = {
  id: string;
  project_id: string | null;
  folder_id: string | null;
  ordering: number;
  title: string;
  content_format: string;
  content_schema_version: number;
  content_json: string;
  plain_text: string;
  current_version: number;
  created_at: string | null;
  updated_at: string;
};

export type RawEntityRow = {
  id: string;
  project_id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export type RawMatchingRuleRow = {
  id: string;
  entity_id: string | null;
  label: string;
  kind: string;
  pattern: string;
  whole_word: number;
  allow_possessive: number;
  enabled: number;
  created_at: string | null;
  updated_at: string;
};

export type RawSliceRow = {
  id: string;
  project_id: string;
  document_id: string;
  boundary_id: string;
  title: string;
  excerpt: string;
  created_at: string;
  updated_at: string;
};

export type RawSliceBoundaryRow = {
  id: string;
  slice_id: string;
  document_id: string;
  anchor_json: string;
  resolution_status: string;
  resolution_reason: string;
  created_at: string;
  updated_at: string;
};

export type RawEntitySliceRow = {
  entity_id: string;
  slice_id: string;
  ordering: number;
};

export type RawLayoutRow = {
  project_id: string;
  active_document_id: string | null;
  panel_document_id: string | null;
  selected_entity_id: string | null;
  expanded_folder_ids_json: string;
  highlights_enabled: number;
  panel_open: number;
  panel_mode: string;
  last_focused_document_id: string | null;
  recent_target_document_ids_json: string;
  updated_at: string;
};

export type RawStepRow = {
  id: string;
  document_id: string;
  version: number;
  step_json: string;
  inverse_step_json: string;
  created_at: string;
};

export type RawCheckpointRow = {
  document_id: string;
  version: number;
  content_format: string;
  content_schema_version: number;
  content_json: string;
  plain_text: string;
  label: string | null;
  created_at: string;
};

export type RawHistoryCountRow = {
  stepCount: number;
  checkpointCount: number;
};

export type RawEventCountRow = {
  eventCount: number;
};
