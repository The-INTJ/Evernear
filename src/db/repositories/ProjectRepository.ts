import type {
  CreateProjectInput,
  ProjectRecord,
  UpdateProjectInput,
} from "../../shared/domain/workspace";
import { DEFAULT_PROJECT_NAME } from "../../shared/domain/workspace";
import type { SqliteHarness } from "../sqliteHarness";
import { isoNow } from "../utils";
import type { RawProjectRow } from "../rowTypes";
import { mapProjectRow } from "../rowMappers";
import type { HistoryRepository } from "./HistoryRepository";

export class ProjectRepository {
  constructor(
    private readonly sqlite: SqliteHarness,
    private readonly history: HistoryRepository,
  ) {}

  // ──────────────── reads ────────────────

  loadProjects(): ProjectRecord[] {
    const rows = this.sqlite.getConnection().prepare(`
      SELECT id, name, created_at, updated_at
      FROM projects
      ORDER BY updated_at DESC, created_at ASC
    `).all() as RawProjectRow[];
    return rows.map(mapProjectRow);
  }

  countProjects(): number {
    const row = this.sqlite.getConnection().prepare(`
      SELECT COUNT(*) AS count
      FROM projects
    `).get() as { count: number };
    return row.count;
  }

  // ──────────────── mutations ────────────────

  createProject(input: CreateProjectInput, projectId: string): string {
    const now = isoNow();
    const name = input.name.trim() || DEFAULT_PROJECT_NAME;
    this.sqlite.getConnection().prepare(`
      INSERT INTO projects (id, name, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `).run(projectId, name, now, now);
    this.history.appendEvent("project", projectId, "projectCreated", 0, { name });
    return name;
  }

  updateProject(input: UpdateProjectInput): void {
    const now = isoNow();
    const name = input.name.trim() || DEFAULT_PROJECT_NAME;
    this.sqlite.getConnection().prepare(`
      UPDATE projects
      SET name = ?, updated_at = ?
      WHERE id = ?
    `).run(name, now, input.projectId);
    this.history.appendEvent("project", input.projectId, "projectUpdated", 0, { name });
  }

  insertSeedProject(projectId: string, name: string): void {
    const now = isoNow();
    this.sqlite.getConnection().prepare(`
      INSERT INTO projects (id, name, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `).run(projectId, name, now, now);
  }
}
