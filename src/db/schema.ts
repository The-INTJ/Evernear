import type BetterSqlite3 from "better-sqlite3";

export function createSchema(database: BetterSqlite3.Database): void {
  resetVeryOldHarnessSchema(database);

  database.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workspace_layout_state (
      project_id TEXT PRIMARY KEY,
      active_document_id TEXT,
      panel_document_id TEXT,
      selected_entity_id TEXT,
      expanded_folder_ids_json TEXT NOT NULL,
      highlights_enabled INTEGER NOT NULL DEFAULT 1,
      panel_open INTEGER NOT NULL DEFAULT 1,
      panel_mode TEXT NOT NULL DEFAULT 'entities',
      last_focused_document_id TEXT,
      recent_target_document_ids_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS document_folders (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      parent_folder_id TEXT,
      title TEXT NOT NULL,
      ordering INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      folder_id TEXT,
      ordering INTEGER NOT NULL DEFAULT 0,
      title TEXT NOT NULL,
      content_format TEXT NOT NULL,
      content_schema_version INTEGER NOT NULL,
      content_json TEXT NOT NULL,
      plain_text TEXT NOT NULL,
      current_version INTEGER NOT NULL DEFAULT 0,
      created_at TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS document_steps (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      step_json TEXT NOT NULL,
      inverse_step_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(document_id, version)
    );

    CREATE TABLE IF NOT EXISTS document_checkpoints (
      document_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      content_format TEXT NOT NULL,
      content_schema_version INTEGER NOT NULL,
      content_json TEXT NOT NULL,
      plain_text TEXT NOT NULL,
      label TEXT,
      created_at TEXT NOT NULL,
      PRIMARY KEY(document_id, version)
    );

    CREATE TABLE IF NOT EXISTS entities (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS matching_rules (
      id TEXT PRIMARY KEY,
      entity_id TEXT,
      label TEXT NOT NULL,
      kind TEXT NOT NULL,
      pattern TEXT NOT NULL,
      whole_word INTEGER NOT NULL,
      allow_possessive INTEGER NOT NULL,
      enabled INTEGER NOT NULL,
      created_at TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS slices (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      document_id TEXT NOT NULL,
      boundary_id TEXT NOT NULL,
      title TEXT NOT NULL,
      excerpt TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS slice_boundaries (
      id TEXT PRIMARY KEY,
      slice_id TEXT NOT NULL,
      document_id TEXT NOT NULL,
      anchor_json TEXT NOT NULL,
      resolution_status TEXT NOT NULL,
      resolution_reason TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS entity_slices (
      entity_id TEXT NOT NULL,
      slice_id TEXT NOT NULL,
      ordering INTEGER NOT NULL,
      PRIMARY KEY(entity_id, slice_id)
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      aggregate_type TEXT NOT NULL,
      aggregate_id TEXT NOT NULL,
      aggregate_seq INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      event_version INTEGER NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS benchmark_results (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS anchor_probes (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      label TEXT NOT NULL,
      document_id TEXT NOT NULL,
      anchor_json TEXT NOT NULL,
      resolution_status TEXT NOT NULL,
      resolution_reason TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  ensureColumn(database, "documents", "project_id", "TEXT");
  ensureColumn(database, "documents", "folder_id", "TEXT");
  ensureColumn(database, "documents", "ordering", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(database, "documents", "created_at", "TEXT");

  ensureColumn(database, "matching_rules", "entity_id", "TEXT");
  ensureColumn(database, "matching_rules", "created_at", "TEXT");

  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_document_folders_project_ordering
      ON document_folders(project_id, ordering);

    CREATE INDEX IF NOT EXISTS idx_documents_project_folder_ordering
      ON documents(project_id, folder_id, ordering);

    CREATE INDEX IF NOT EXISTS idx_document_steps_document_version
      ON document_steps(document_id, version);

    CREATE INDEX IF NOT EXISTS idx_document_checkpoints_document_version
      ON document_checkpoints(document_id, version);

    CREATE INDEX IF NOT EXISTS idx_entities_project_updated_at
      ON entities(project_id, updated_at DESC);

    CREATE INDEX IF NOT EXISTS idx_matching_rules_entity
      ON matching_rules(entity_id, updated_at DESC);

    CREATE INDEX IF NOT EXISTS idx_slices_project_document
      ON slices(project_id, document_id, updated_at DESC);

    CREATE INDEX IF NOT EXISTS idx_slice_boundaries_document
      ON slice_boundaries(document_id, updated_at DESC);

    CREATE INDEX IF NOT EXISTS idx_entity_slices_entity
      ON entity_slices(entity_id, ordering);

    CREATE INDEX IF NOT EXISTS idx_events_aggregate_version
      ON events(aggregate_type, aggregate_id, event_version);

    CREATE INDEX IF NOT EXISTS idx_benchmark_results_category
      ON benchmark_results(category, created_at DESC);
  `);
}

function ensureColumn(
  database: BetterSqlite3.Database,
  tableName: string,
  columnName: string,
  definition: string,
): void {
  const columns = database.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  if (columns.some((column) => column.name === columnName)) {
    return;
  }

  database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
}

function resetVeryOldHarnessSchema(database: BetterSqlite3.Database): void {
  const hasDocumentsTable = database
    .prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table' AND name = 'documents'
    `)
    .get() as { name: string } | undefined;

  if (!hasDocumentsTable) {
    return;
  }

  const documentColumns = database.prepare("PRAGMA table_info(documents)").all() as Array<{ name: string }>;
  const hasCurrentVersion = documentColumns.some((column) => column.name === "current_version");
  if (hasCurrentVersion) {
    return;
  }

  database.exec(`
    DROP TABLE IF EXISTS documents;
    DROP TABLE IF EXISTS document_steps;
    DROP TABLE IF EXISTS document_checkpoints;
    DROP TABLE IF EXISTS events;
    DROP TABLE IF EXISTS anchor_probes;
    DROP TABLE IF EXISTS matching_rules;
    DROP TABLE IF EXISTS benchmark_results;
  `);
}
