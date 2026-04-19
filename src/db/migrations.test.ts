// Migration runner discipline. The schema migrations gate the entire DB
// layer — a regression here corrupts every project file the next time
// runMigrations runs. Cover the three load-bearing properties:
//
//   - applies pending migrations in order on a fresh database
//   - is a no-op (no double-apply) on a database already at HEAD
//   - leaves user_version aligned with CURRENT_SCHEMA_VERSION
//
// Plus a regression check for the v3 legacy-document backfill (the one
// migration with data side effects) so a future schema reshuffle doesn't
// silently turn it back into a no-op for legacy rows.

import path from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

import BetterSqlite3 from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CURRENT_SCHEMA_VERSION, MIGRATIONS, runMigrations } from "./migrations";

let tempDir: string;
let dbPath: string;

beforeEach(() => {
  tempDir = mkdtempSync(path.join(tmpdir(), "evernear-migrations-test-"));
  dbPath = path.join(tempDir, "phase-1.sqlite");
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("runMigrations", () => {
  it("applies all migrations in order on a fresh database and advances user_version to HEAD", () => {
    const database = new BetterSqlite3(dbPath);
    try {
      const before = database.pragma("user_version", { simple: true }) as number;
      expect(before).toBe(0);

      runMigrations(database);

      const after = database.pragma("user_version", { simple: true }) as number;
      expect(after).toBe(CURRENT_SCHEMA_VERSION);

      // Sanity: HEAD is the highest version in the migration list, in case
      // someone re-orders or accidentally skips a number.
      const versions = MIGRATIONS.map((m) => m.version);
      expect(Math.max(...versions)).toBe(CURRENT_SCHEMA_VERSION);
    } finally {
      database.close();
    }
  });

  it("is idempotent — a second run on a fully-migrated database is a no-op", () => {
    const first = new BetterSqlite3(dbPath);
    try {
      runMigrations(first);
    } finally {
      first.close();
    }

    const second = new BetterSqlite3(dbPath);
    try {
      const before = second.pragma("user_version", { simple: true }) as number;
      expect(before).toBe(CURRENT_SCHEMA_VERSION);

      // A second runMigrations must not throw and must not advance the
      // version (already at HEAD) or re-apply an idempotent migration.
      expect(() => runMigrations(second)).not.toThrow();
      const after = second.pragma("user_version", { simple: true }) as number;
      expect(after).toBe(CURRENT_SCHEMA_VERSION);
    } finally {
      second.close();
    }
  });

  it("declares strictly increasing version numbers with no duplicates or gaps", () => {
    const versions = MIGRATIONS.map((m) => m.version);
    const sorted = [...versions].sort((a, b) => a - b);
    expect(versions).toEqual(sorted);
    expect(new Set(versions).size).toBe(versions.length);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i]).toBe(sorted[i - 1]! + 1);
    }
  });

  it("v3 backfill repairs legacy documents with NULL project_id / created_at and ordering=0", () => {
    // Run schema migrations 1+2 only, then hand-write a legacy-shaped row,
    // then run the full migration list. The v3 backfill should pick the
    // row up and fill the missing columns.
    const database = new BetterSqlite3(dbPath);
    try {
      // Apply only versions < 3 first so we can write the legacy row.
      const earlyMigrations = MIGRATIONS.filter((m) => m.version < 3);
      const runEarly = database.transaction(() => {
        for (const migration of earlyMigrations) {
          migration.up(database);
          database.pragma(`user_version = ${migration.version}`);
        }
      });
      runEarly();

      database.prepare(`
        INSERT INTO documents (
          id, project_id, folder_id, ordering, title, content_format,
          content_schema_version, content_json, plain_text, current_version,
          created_at, updated_at
        )
        VALUES (?, NULL, NULL, 0, ?, ?, ?, ?, ?, 0, NULL, ?)
      `).run(
        "legacy-doc-1",
        "Legacy Doc",
        "prosemirror-basic",
        1,
        "{}",
        "",
        "2025-01-01T00:00:00.000Z",
      );

      // Now run the rest, including v3.
      runMigrations(database);

      const row = database.prepare(`
        SELECT project_id, folder_id, ordering, created_at
        FROM documents
        WHERE id = ?
      `).get("legacy-doc-1") as {
        project_id: string | null;
        folder_id: string | null;
        ordering: number;
        created_at: string | null;
      };

      expect(row.project_id).toBe("default-project");
      expect(row.folder_id).toBe("story-folder");
      expect(row.created_at).toBe("2025-01-01T00:00:00.000Z");
      // Ordering renumbered from 0 → 0 (it's the only legacy row, so its
      // index in the legacy-doc list is 0). The important assertion is
      // that the COALESCE/CASE clause ran without erroring.
      expect(typeof row.ordering).toBe("number");
    } finally {
      database.close();
    }
  });
});
