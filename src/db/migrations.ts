// Schema versioning.
//
// SQLite has a built-in `user_version` pragma for exactly this purpose:
// a single integer stored with the database file. On open we compare it
// with CURRENT_SCHEMA_VERSION and apply any pending migrations in order,
// inside a transaction.
//
// Migration rules:
//   - Append only: new migrations get a new version number + index; never
//     edit or renumber existing ones.
//   - Idempotent is still nice (IF NOT EXISTS, IF EXISTS), but the version
//     check means we don't re-run an already-applied migration.
//   - Migrations may add columns, tables, or indexes; if you need to
//     destructively change a column, do it in two migrations (add new,
//     backfill, drop old) so partially-migrated DBs survive.
//   - No business logic in here — just schema shape. Data transformations
//     that depend on domain logic belong in a repository method, not here.
//
// Rationale: see refineCode.md §C7. Previously the codebase relied on
// CREATE TABLE IF NOT EXISTS + ad-hoc ALTER TABLE checks in schema.ts;
// that works for MVP but will quietly fail once real users have real
// files with columns we want to change.

import type BetterSqlite3 from "better-sqlite3";

export type Migration = {
  version: number;
  description: string;
  up(database: BetterSqlite3.Database): void;
};

// Ordered list. Each migration advances user_version to its `version` on success.
// New migrations: append, never re-order or re-number.
export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    description: "initial schema (workspace-phase-1)",
    up(database) {
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
    },
  },
  {
    version: 2,
    description: "indexes for hot read paths",
    up(database) {
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
    },
  },
];

export const CURRENT_SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1]?.version ?? 0;

export function runMigrations(database: BetterSqlite3.Database): void {
  resetVeryOldHarnessSchema(database);
  backfillLegacyColumns(database);

  const currentVersion = (database.pragma("user_version", { simple: true }) as number) ?? 0;
  const pending = MIGRATIONS.filter((migration) => migration.version > currentVersion);
  if (pending.length === 0) {
    return;
  }

  const runAll = database.transaction(() => {
    for (const migration of pending) {
      migration.up(database);
      database.pragma(`user_version = ${migration.version}`);
    }
  });
  runAll();
}

// Historical one-shot: earlier prototypes wrote a very different `documents`
// table. If we still see that shape, drop the small cluster of tables that
// held incompatible columns so migration 1 can create the current shape.
// Keep here until no remaining local DB files pre-date Phase 1.
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

// Historical one-shot: rows written by pre-Phase-1 builds may be missing
// project_id / folder_id / ordering / created_at. Migration 1 declares
// these as NULL-able / defaulted; this helper fills them on open so
// subsequent queries can treat them as populated.
function backfillLegacyColumns(database: BetterSqlite3.Database): void {
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

  ensureColumn(database, "documents", "project_id", "TEXT");
  ensureColumn(database, "documents", "folder_id", "TEXT");
  ensureColumn(database, "documents", "ordering", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(database, "documents", "created_at", "TEXT");
  ensureColumn(database, "matching_rules", "entity_id", "TEXT");
  ensureColumn(database, "matching_rules", "created_at", "TEXT");
}

function ensureColumn(
  database: BetterSqlite3.Database,
  tableName: string,
  columnName: string,
  definition: string,
): void {
  const table = database
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`)
    .get(tableName) as { name: string } | undefined;
  if (!table) {
    return;
  }
  const columns = database.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  if (columns.some((column) => column.name === columnName)) {
    return;
  }
  database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
}
