// Owns the workspace_layout_state projection + the app_state "activeProjectId"
// pointer. Layout is UI-driven ephemeral data with a long shelf life —
// store it so reopening the app returns the user to their seat, but don't
// treat it as an event-sourced aggregate.

import type { DocumentSummary, EntityRecord, WorkspaceLayoutState } from "../../shared/domain/workspace";
import { DEFAULT_PROJECT_ID } from "../../shared/domain/workspace";
import type { SqliteHarness } from "../sqliteHarness";
import { boolToInt, intToBool, isoNow, safeParseStringArray } from "../utils";
import type { RawLayoutRow } from "../rowTypes";

export type LayoutFolderResolver = (projectId: string) => string[];

export class LayoutRepository {
  constructor(private readonly sqlite: SqliteHarness) {}

  loadActiveProjectId(): string | null {
    const row = this.sqlite.getConnection().prepare(`
      SELECT value_json
      FROM app_state
      WHERE key = 'activeProjectId'
    `).get() as { value_json: string } | undefined;

    if (!row) {
      return null;
    }

    try {
      const parsed = JSON.parse(row.value_json) as { projectId?: string };
      return parsed.projectId ?? null;
    } catch {
      return null;
    }
  }

  requireActiveProjectId(): string {
    return this.loadActiveProjectId() ?? DEFAULT_PROJECT_ID;
  }

  setActiveProjectId(projectId: string): void {
    this.sqlite.getConnection().prepare(`
      INSERT INTO app_state (key, value_json)
      VALUES ('activeProjectId', ?)
      ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json
    `).run(JSON.stringify({ projectId }));
  }

  // Returns (and, on first read per project, persists) a layout row. The
  // folder resolver is injected so LayoutRepository doesn't need to reach
  // into FolderRepository — keeps the dep direction clean.
  loadLayoutState(
    projectId: string,
    documents: DocumentSummary[],
    entities: EntityRecord[],
    resolveFolderIds: LayoutFolderResolver,
  ): WorkspaceLayoutState {
    const database = this.sqlite.getConnection();
    const row = database.prepare(`
      SELECT
        project_id,
        active_document_id,
        panel_document_id,
        selected_entity_id,
        expanded_folder_ids_json,
        highlights_enabled,
        panel_open,
        panel_mode,
        last_focused_document_id,
        recent_target_document_ids_json,
        updated_at
      FROM workspace_layout_state
      WHERE project_id = ?
    `).get(projectId) as RawLayoutRow | undefined;

    const defaultLayout: WorkspaceLayoutState = {
      activeProjectId: projectId,
      activeDocumentId: documents[0]?.id ?? null,
      panelDocumentId: null,
      selectedEntityId: entities[0]?.id ?? null,
      expandedFolderIds: resolveFolderIds(projectId),
      highlightsEnabled: true,
      panelOpen: true,
      panelMode: "entities",
      lastFocusedDocumentId: documents[0]?.id ?? null,
      recentTargetDocumentIds: documents[0]?.id ? [documents[0].id] : [],
    };

    if (!row) {
      this.saveLayoutState(projectId, defaultLayout);
      return defaultLayout;
    }

    const layout: WorkspaceLayoutState = {
      activeProjectId: projectId,
      activeDocumentId: row.active_document_id ?? defaultLayout.activeDocumentId,
      panelDocumentId: row.panel_document_id,
      selectedEntityId: row.selected_entity_id ?? defaultLayout.selectedEntityId,
      expandedFolderIds: safeParseStringArray(row.expanded_folder_ids_json, defaultLayout.expandedFolderIds),
      highlightsEnabled: intToBool(row.highlights_enabled),
      panelOpen: intToBool(row.panel_open),
      panelMode: row.panel_mode as WorkspaceLayoutState["panelMode"],
      lastFocusedDocumentId: row.last_focused_document_id ?? defaultLayout.lastFocusedDocumentId,
      recentTargetDocumentIds: safeParseStringArray(row.recent_target_document_ids_json, defaultLayout.recentTargetDocumentIds),
    };

    if (layout.activeDocumentId === null && documents[0]) {
      const repaired = {
        ...layout,
        activeDocumentId: documents[0].id,
        lastFocusedDocumentId: documents[0].id,
      };
      this.saveLayoutState(projectId, repaired);
      return repaired;
    }

    return layout;
  }

  saveLayoutState(projectId: string, layout: WorkspaceLayoutState): void {
    this.sqlite.getConnection().prepare(`
      INSERT INTO workspace_layout_state (
        project_id,
        active_document_id,
        panel_document_id,
        selected_entity_id,
        expanded_folder_ids_json,
        highlights_enabled,
        panel_open,
        panel_mode,
        last_focused_document_id,
        recent_target_document_ids_json,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(project_id) DO UPDATE SET
        active_document_id = excluded.active_document_id,
        panel_document_id = excluded.panel_document_id,
        selected_entity_id = excluded.selected_entity_id,
        expanded_folder_ids_json = excluded.expanded_folder_ids_json,
        highlights_enabled = excluded.highlights_enabled,
        panel_open = excluded.panel_open,
        panel_mode = excluded.panel_mode,
        last_focused_document_id = excluded.last_focused_document_id,
        recent_target_document_ids_json = excluded.recent_target_document_ids_json,
        updated_at = excluded.updated_at
    `).run(
      projectId,
      layout.activeDocumentId,
      layout.panelDocumentId,
      layout.selectedEntityId,
      JSON.stringify(layout.expandedFolderIds),
      boolToInt(layout.highlightsEnabled),
      boolToInt(layout.panelOpen),
      layout.panelMode,
      layout.lastFocusedDocumentId,
      JSON.stringify(layout.recentTargetDocumentIds),
      isoNow(),
    );
  }
}
