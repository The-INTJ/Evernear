import type {
  CreateEntityInput,
  DeleteEntityInput,
  DeleteMatchingRuleInput,
  EntityRecord,
  MatchingRuleRecord,
  UpdateEntityInput,
  UpsertMatchingRuleInput,
} from "../../shared/domain/workspace";
import type { SqliteHarness } from "../sqliteHarness";
import { boolToInt, isoNow } from "../utils";
import type { RawEntityRow, RawMatchingRuleRow } from "../rowTypes";
import { mapEntityRow, mapMatchingRuleRow } from "../rowMappers";
import type { HistoryRepository } from "./HistoryRepository";

export type DeletedEntity = {
  projectId: string;
  name: string;
  orphanedSliceIds: string[];
};

export class EntityRepository {
  constructor(
    private readonly sqlite: SqliteHarness,
    private readonly history: HistoryRepository,
  ) {}

  // ──────────────── reads ────────────────

  loadEntities(projectId: string): EntityRecord[] {
    const rows = this.sqlite.getConnection().prepare(`
      SELECT id, project_id, name, created_at, updated_at
      FROM entities
      WHERE project_id = ?
      ORDER BY updated_at DESC, name COLLATE NOCASE ASC
    `).all(projectId) as RawEntityRow[];
    return rows.map(mapEntityRow);
  }

  loadEntity(entityId: string): EntityRecord | null {
    const row = this.sqlite.getConnection().prepare(`
      SELECT id, project_id, name, created_at, updated_at
      FROM entities
      WHERE id = ?
    `).get(entityId) as RawEntityRow | undefined;
    return row ? mapEntityRow(row) : null;
  }

  loadMatchingRulesForProject(projectId: string): MatchingRuleRecord[] {
    const rows = this.sqlite.getConnection().prepare(`
      SELECT
        matching_rules.id,
        matching_rules.entity_id,
        matching_rules.label,
        matching_rules.kind,
        matching_rules.pattern,
        matching_rules.whole_word,
        matching_rules.allow_possessive,
        matching_rules.enabled,
        matching_rules.created_at,
        matching_rules.updated_at
      FROM matching_rules
      INNER JOIN entities ON entities.id = matching_rules.entity_id
      WHERE entities.project_id = ?
      ORDER BY matching_rules.updated_at DESC, matching_rules.label COLLATE NOCASE ASC
    `).all(projectId) as RawMatchingRuleRow[];
    return rows.flatMap((row) => {
      const mapped = mapMatchingRuleRow(row);
      return mapped ? [mapped] : [];
    });
  }

  // ──────────────── entity mutations ────────────────

  createEntity(input: CreateEntityInput, entityId: string): EntityRecord {
    const now = isoNow();
    const name = input.name.trim() || "Untitled Entity";
    this.sqlite.getConnection().prepare(`
      INSERT INTO entities (id, project_id, name, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(entityId, input.projectId, name, now, now);
    this.history.appendEvent("entity", entityId, "entityCreated", 0, { name });
    return {
      id: entityId,
      projectId: input.projectId,
      name,
      createdAt: now,
      updatedAt: now,
    };
  }

  updateEntity(input: UpdateEntityInput): void {
    const name = input.name.trim() || "Untitled Entity";
    this.sqlite.getConnection().prepare(`
      UPDATE entities
      SET name = ?, updated_at = ?
      WHERE id = ?
    `).run(name, isoNow(), input.entityId);
    this.history.appendEvent("entity", input.entityId, "entityUpdated", 0, { name });
  }

  deleteEntity(input: DeleteEntityInput): DeletedEntity | null {
    const database = this.sqlite.getConnection();
    const entity = database.prepare(`
      SELECT id, project_id, name, created_at, updated_at
      FROM entities
      WHERE id = ?
    `).get(input.entityId) as RawEntityRow | undefined;
    if (!entity) {
      return null;
    }

    const sliceRows = database.prepare(`
      SELECT slice_id
      FROM entity_slices
      WHERE entity_id = ?
    `).all(input.entityId) as Array<{ slice_id: string }>;

    database.prepare("DELETE FROM matching_rules WHERE entity_id = ?").run(input.entityId);
    database.prepare("DELETE FROM entity_slices WHERE entity_id = ?").run(input.entityId);
    database.prepare("DELETE FROM entities WHERE id = ?").run(input.entityId);

    this.history.appendEvent("entity", input.entityId, "entityDeleted", 0, { name: entity.name });

    return {
      projectId: entity.project_id,
      name: entity.name,
      orphanedSliceIds: sliceRows.map((row) => row.slice_id),
    };
  }

  // ──────────────── matching rule mutations ────────────────

  upsertMatchingRule(input: UpsertMatchingRuleInput, ruleId: string): void {
    const now = isoNow();
    const isNew = !input.id;
    const createdAt = input.id
      ? (this.sqlite.getConnection().prepare(
          "SELECT created_at FROM matching_rules WHERE id = ?",
        ).get(ruleId) as { created_at: string | null } | undefined)?.created_at ?? now
      : now;

    this.sqlite.getConnection().prepare(`
      INSERT INTO matching_rules (
        id,
        entity_id,
        label,
        kind,
        pattern,
        whole_word,
        allow_possessive,
        enabled,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        entity_id = excluded.entity_id,
        label = excluded.label,
        kind = excluded.kind,
        pattern = excluded.pattern,
        whole_word = excluded.whole_word,
        allow_possessive = excluded.allow_possessive,
        enabled = excluded.enabled,
        updated_at = excluded.updated_at
    `).run(
      ruleId,
      input.entityId,
      input.label,
      input.kind,
      input.pattern,
      boolToInt(input.wholeWord),
      boolToInt(input.allowPossessive),
      boolToInt(input.enabled),
      createdAt,
      now,
    );

    this.history.appendEvent(
      "matchingRule",
      ruleId,
      isNew ? "matchingRuleCreated" : "matchingRuleUpdated",
      0,
      {
        entityId: input.entityId,
        label: input.label,
        kind: input.kind,
        pattern: input.pattern,
      },
    );
  }

  deleteMatchingRule(input: DeleteMatchingRuleInput): void {
    const database = this.sqlite.getConnection();
    const row = database.prepare(`
      SELECT entity_id, label
      FROM matching_rules
      WHERE id = ?
    `).get(input.ruleId) as { entity_id: string | null; label: string } | undefined;
    if (!row) {
      return;
    }

    database.prepare("DELETE FROM matching_rules WHERE id = ?").run(input.ruleId);

    this.history.appendEvent("matchingRule", input.ruleId, "matchingRuleDeleted", 0, {
      entityId: row.entity_id ?? "",
      label: row.label,
    });
  }

  // ──────────────── seed bootstrap ────────────────

  // Legacy matching_rules rows can predate entities being a table — give
  // each an "Imported Entity" wrapper so downstream joins don't hide them.
  // Unlike the other seed-state work in WorkspaceRepository.ensureSeedState,
  // this CAN run on a non-empty database (any orphaned rule will trigger
  // it), so it must append events to keep the event log a complete record
  // of mutations.
  adoptOrphanedMatchingRules(projectId: string, createEntityId: () => string): void {
    const database = this.sqlite.getConnection();
    const orphans = database.prepare(`
      SELECT id, label, kind, pattern, updated_at
      FROM matching_rules
      WHERE entity_id IS NULL
      ORDER BY updated_at ASC
    `).all() as Array<{ id: string; label: string; kind: string; pattern: string; updated_at: string }>;

    for (const rule of orphans) {
      const entityId = createEntityId();
      const entityName = rule.label || "Imported Entity";
      database.prepare(`
        INSERT INTO entities (id, project_id, name, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(entityId, projectId, entityName, rule.updated_at, rule.updated_at);
      this.history.appendEvent("entity", entityId, "entityCreated", 0, { name: entityName });

      database.prepare(`
        UPDATE matching_rules
        SET entity_id = ?, created_at = COALESCE(created_at, updated_at)
        WHERE id = ?
      `).run(entityId, rule.id);
      this.history.appendEvent("matchingRule", rule.id, "matchingRuleUpdated", 0, {
        entityId,
        label: rule.label,
        kind: rule.kind as MatchingRuleRecord["kind"],
        pattern: rule.pattern,
      });
    }
  }
}
