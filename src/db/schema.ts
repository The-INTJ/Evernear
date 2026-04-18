import type BetterSqlite3 from "better-sqlite3";

export function createSchema(database: BetterSqlite3.Database): void {
  resetLegacyWorkbenchSchema(database);

  database.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content_format TEXT NOT NULL,
      content_schema_version INTEGER NOT NULL,
      content_json TEXT NOT NULL,
      plain_text TEXT NOT NULL,
      current_version INTEGER NOT NULL DEFAULT 0,
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

    CREATE TABLE IF NOT EXISTS matching_rules (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      kind TEXT NOT NULL,
      pattern TEXT NOT NULL,
      whole_word INTEGER NOT NULL,
      allow_possessive INTEGER NOT NULL,
      enabled INTEGER NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS benchmark_results (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_document_steps_document_version
      ON document_steps(document_id, version);

    CREATE INDEX IF NOT EXISTS idx_document_checkpoints_document_version
      ON document_checkpoints(document_id, version);

    CREATE INDEX IF NOT EXISTS idx_events_aggregate_version
      ON events(aggregate_type, aggregate_id, event_version);

    CREATE INDEX IF NOT EXISTS idx_benchmark_results_category
      ON benchmark_results(category, created_at DESC);
  `);
}

function resetLegacyWorkbenchSchema(database: BetterSqlite3.Database): void {
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

  const documentColumns = database
    .prepare("PRAGMA table_info(documents)")
    .all() as Array<{ name: string }>;

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
