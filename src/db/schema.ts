import type { Database } from "sql.js";

export function createSchema(database: Database): void {
  database.run(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content_format TEXT NOT NULL,
      content_schema_version INTEGER NOT NULL,
      content_json TEXT NOT NULL,
      plain_text TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

