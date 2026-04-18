import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";

import { createSchema } from "./schema";

export class SqliteHarness {
  private constructor(
    private readonly engine: SqlJsStatic,
    private readonly database: Database,
    readonly filePath: string,
  ) {}

  static async open(filePath: string): Promise<SqliteHarness> {
    mkdirSync(path.dirname(filePath), { recursive: true });

    const sqlJsRoot = resolveSqlJsRoot();
    const engine = await initSqlJs({
      locateFile: (file) => path.join(sqlJsRoot, "node_modules", "sql.js", "dist", file),
    });

    const buffer = existsSync(filePath)
      ? new Uint8Array(readFileSync(filePath))
      : undefined;
    const database = buffer ? new engine.Database(buffer) : new engine.Database();

    createSchema(database);

    const harness = new SqliteHarness(engine, database, filePath);
    harness.persist();
    return harness;
  }

  getConnection(): Database {
    return this.database;
  }

  runInTransaction<T>(callback: () => T): T {
    this.database.run("BEGIN");

    try {
      const result = callback();
      this.database.run("COMMIT");
      this.persist();
      return result;
    } catch (error) {
      try {
        this.database.run("ROLLBACK");
      } catch {
        // Ignore rollback failures so the original error survives.
      }

      throw error;
    }
  }

  private persist(): void {
    const bytes = this.database.export();
    writeFileSync(this.filePath, Buffer.from(bytes));
  }
}

function resolveSqlJsRoot(): string {
  const candidates = [
    process.cwd(),
    path.resolve(__dirname, "../.."),
    path.resolve(__dirname, "../../.."),
  ];

  for (const candidate of candidates) {
    const wasmPath = path.join(candidate, "node_modules", "sql.js", "dist", "sql-wasm.wasm");
    if (existsSync(wasmPath)) {
      return candidate;
    }
  }

  throw new Error("Could not locate sql.js runtime assets.");
}
