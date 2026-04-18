import { mkdirSync } from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

import { runMigrations } from "./migrations";

export class SqliteHarness {
  private constructor(
    private readonly database: Database.Database,
    readonly filePath: string,
    readonly synchronousMode: "FULL" | "NORMAL",
  ) {}

  static open(
    filePath: string,
    synchronousMode: "FULL" | "NORMAL" = "FULL",
  ): SqliteHarness {
    mkdirSync(path.dirname(filePath), { recursive: true });

    const database = new Database(filePath);
    database.pragma("journal_mode = WAL");
    database.pragma(`synchronous = ${synchronousMode}`);
    database.pragma("foreign_keys = ON");

    runMigrations(database);

    return new SqliteHarness(database, filePath, synchronousMode);
  }

  getConnection(): Database.Database {
    return this.database;
  }

  runInTransaction<T>(callback: () => T): T {
    const transaction = this.database.transaction(callback);
    return transaction();
  }

  close(): void {
    this.database.close();
  }
}
