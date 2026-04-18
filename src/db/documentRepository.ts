import {
  type SaveHarnessDocumentInput,
  type SeedFixtureResult,
  type StoredDocumentSnapshot,
} from "../shared/domain/document";
import {
  createEmptyHarnessSnapshot,
  createLongManuscriptFixture,
} from "../shared/domain/harnessFixture";
import { SqliteHarness } from "./sqliteHarness";

type RawDocumentRow = {
  id: string;
  title: string;
  content_format: string;
  content_schema_version: number;
  content_json: string;
  plain_text: string;
  updated_at: string;
};

export class HarnessDocumentRepository {
  constructor(private readonly sqliteHarness: SqliteHarness) {}

  ensureHarnessDocument(): StoredDocumentSnapshot {
    const existing = this.loadHarnessDocument();
    if (existing) {
      return existing;
    }

    const empty = createEmptyHarnessSnapshot();
    return this.saveHarnessDocument({
      id: empty.id,
      title: empty.title,
      contentJson: empty.contentJson,
      plainText: empty.plainText,
    });
  }

  loadHarnessDocument(): StoredDocumentSnapshot | null {
    const database = this.sqliteHarness.getConnection();
    const statement = database.prepare(`
      SELECT
        id,
        title,
        content_format,
        content_schema_version,
        content_json,
        plain_text,
        updated_at
      FROM documents
      WHERE id = ?
      LIMIT 1
    `);

    try {
      statement.bind([createEmptyHarnessSnapshot().id]);

      if (!statement.step()) {
        return null;
      }

      const row = statement.getAsObject() as unknown as RawDocumentRow;
      return mapRowToSnapshot(row);
    } finally {
      statement.free();
    }
  }

  saveHarnessDocument(input: SaveHarnessDocumentInput): StoredDocumentSnapshot {
    return this.sqliteHarness.runInTransaction(() => {
      const database = this.sqliteHarness.getConnection();
      const updatedAt = new Date().toISOString();

      database.run(
        `
          INSERT INTO documents (
            id,
            title,
            content_format,
            content_schema_version,
            content_json,
            plain_text,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            content_format = excluded.content_format,
            content_schema_version = excluded.content_schema_version,
            content_json = excluded.content_json,
            plain_text = excluded.plain_text,
            updated_at = excluded.updated_at
        `,
        [
          input.id,
          input.title,
          createEmptyHarnessSnapshot().contentFormat,
          createEmptyHarnessSnapshot().contentSchemaVersion,
          JSON.stringify(input.contentJson),
          input.plainText,
          updatedAt,
        ],
      );

      const snapshot = this.loadHarnessDocument();
      if (!snapshot) {
        throw new Error("Expected the harness document to exist after save.");
      }

      return snapshot;
    });
  }

  seedFixtureDocument(): SeedFixtureResult {
    const fixture = createLongManuscriptFixture();
    const snapshot = this.saveHarnessDocument({
      id: fixture.snapshot.id,
      title: fixture.snapshot.title,
      contentJson: fixture.snapshot.contentJson,
      plainText: fixture.snapshot.plainText,
    });

    return {
      snapshot,
      wordCount: fixture.wordCount,
    };
  }
}

function mapRowToSnapshot(row: RawDocumentRow): StoredDocumentSnapshot {
  return {
    id: row.id,
    title: row.title,
    contentFormat: row.content_format,
    contentSchemaVersion: row.content_schema_version,
    contentJson: JSON.parse(row.content_json) as StoredDocumentSnapshot["contentJson"],
    plainText: row.plain_text,
    updatedAt: row.updated_at,
  };
}

