// Entity-aggregate event-log discipline. Same R2 contract as
// DocumentRepository.test.ts: every row-mutating call appends exactly one
// event, so a replay from the log can rebuild the projection.

import path from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { SqliteHarness } from "../sqliteHarness";
import { WorkspaceRepository } from "./WorkspaceRepository";

let tempDir: string;
let repository: WorkspaceRepository;
let harness: SqliteHarness;

beforeEach(() => {
  tempDir = mkdtempSync(path.join(tmpdir(), "evernear-entity-repo-test-"));
  const dbPath = path.join(tempDir, "phase-1.sqlite");
  harness = SqliteHarness.open(dbPath, "NORMAL");
  repository = new WorkspaceRepository(harness);
});

afterEach(() => {
  harness.close();
  rmSync(tempDir, { recursive: true, force: true });
});

describe("EntityRepository.setEntityRules", () => {
  function createAragorn(): string {
    const projectId = repository.ensureWorkspaceState().layout.activeProjectId!;
    return repository.createEntity({
      projectId,
      name: "Aragorn",
      rules: [
        { pattern: "\\bAragorn\\b", enabled: true },
        { pattern: "\\bStrider\\b", enabled: true },
      ],
    }).layout.selectedEntityId!;
  }

  function rulesOf(entityId: string) {
    return repository.loadWorkspace().matchingRules.filter((rule) => rule.entityId === entityId);
  }

  it("creates starting rules with the entity, one matchingRuleCreated event each", () => {
    const createdBefore = countEvents(harness, "matchingRule", "matchingRuleCreated");
    const entityId = createAragorn();
    expect(rulesOf(entityId).map((rule) => rule.pattern).sort()).toEqual(["\\bAragorn\\b", "\\bStrider\\b"]);
    expect(countEvents(harness, "matchingRule", "matchingRuleCreated")).toBe(createdBefore + 2);
  });

  it("keeps ids for unchanged patterns, deletes missing ones, and creates new ones", () => {
    const entityId = createAragorn();
    const aragornId = rulesOf(entityId).find((rule) => rule.pattern === "\\bAragorn\\b")!.id;
    const deletedBefore = countEvents(harness, "matchingRule", "matchingRuleDeleted");
    const updatedBefore = countEvents(harness, "matchingRule", "matchingRuleUpdated");

    repository.setEntityRules({
      entityId,
      rules: [
        { pattern: "\\bAragorn\\b", enabled: true },
        { pattern: "\\bElessar\\b", enabled: true },
      ],
    });

    const after = rulesOf(entityId);
    expect(after.map((rule) => rule.pattern).sort()).toEqual(["\\bAragorn\\b", "\\bElessar\\b"]);
    expect(after.find((rule) => rule.pattern === "\\bAragorn\\b")!.id).toBe(aragornId);
    expect(countEvents(harness, "matchingRule", "matchingRuleDeleted")).toBe(deletedBefore + 1);
    expect(countEvents(harness, "matchingRule", "matchingRuleUpdated")).toBe(updatedBefore);

    const payload = latestEventPayload(harness, "matchingRule", "matchingRuleDeleted");
    expect(payload.entityId).toBe(entityId);
    expect(payload.label).toBe("\\bStrider\\b");
  });

  it("only appends an update when a kept rule's enabled flag changes", () => {
    const entityId = createAragorn();
    const updatedBefore = countEvents(harness, "matchingRule", "matchingRuleUpdated");

    repository.setEntityRules({
      entityId,
      rules: [
        { pattern: "\\bAragorn\\b", enabled: true },
        { pattern: "\\bStrider\\b", enabled: false },
        { pattern: "\\bStrider\\b", enabled: true },
      ],
    });

    const strider = rulesOf(entityId).filter((rule) => rule.pattern === "\\bStrider\\b");
    expect(strider).toHaveLength(1);
    expect(strider[0]!.enabled).toBe(false);
    expect(countEvents(harness, "matchingRule", "matchingRuleUpdated")).toBe(updatedBefore + 1);
  });
});

describe("EntityRepository.convertLegacyMatchingRules", () => {
  function insertLegacyRule(entityId: string, id: string, kind: string, pattern: string, wholeWord: boolean): void {
    harness.getConnection().prepare(`
      INSERT INTO matching_rules
        (id, entity_id, label, kind, pattern, whole_word, allow_possessive, enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, 1, '2026-04-01T00:00:00.000Z', '2026-04-01T00:00:00.000Z')
    `).run(id, entityId, pattern, kind, pattern, wholeWord ? 1 : 0);
  }

  it("rewrites literal and alias rules as regexes once, appending one event each", () => {
    const state = repository.ensureWorkspaceState();
    const projectId = state.layout.activeProjectId!;
    const entityId = repository.createEntity({ projectId, name: "The Spire" }).layout.selectedEntityId!;
    insertLegacyRule(entityId, "legacy-literal", "literal", "The Spire", true);
    insertLegacyRule(entityId, "legacy-alias", "alias", "Spire", false);
    const eventsBefore = countEvents(harness, "matchingRule", "matchingRuleUpdated");

    const rules = repository.loadWorkspace().matchingRules;
    expect(rules.find((rule) => rule.id === "legacy-literal")?.pattern).toBe("\\bThe\\s+Spire\\b");
    expect(rules.find((rule) => rule.id === "legacy-alias")?.pattern).toBe("Spire");
    expect(countEvents(harness, "matchingRule", "matchingRuleUpdated")).toBe(eventsBefore + 2);

    const kinds = harness.getConnection()
      .prepare("SELECT DISTINCT kind FROM matching_rules")
      .all() as Array<{ kind: string }>;
    expect(kinds.map((row) => row.kind)).toEqual(["regex"]);

    repository.loadWorkspace();
    expect(countEvents(harness, "matchingRule", "matchingRuleUpdated")).toBe(eventsBefore + 2);
  });

  it("leaves rules that were already regexes untouched", () => {
    const state = repository.ensureWorkspaceState();
    const projectId = state.layout.activeProjectId!;
    const entityId = repository.createEntity({ projectId, name: "Spire" }).layout.selectedEntityId!;
    insertLegacyRule(entityId, "legacy-regex", "regex", "spires?", false);

    const rule = repository.loadWorkspace().matchingRules.find((r) => r.id === "legacy-regex");
    expect(rule?.pattern).toBe("spires?");
  });
});

function countEvents(h: SqliteHarness, aggregate: string, eventType: string): number {
  const row = h.getConnection()
    .prepare(`
      SELECT COUNT(*) AS count
      FROM events
      WHERE aggregate_type = ? AND event_type = ?
    `)
    .get(aggregate, eventType) as { count: number };
  return row.count;
}

function latestEventPayload(h: SqliteHarness, aggregate: string, eventType: string): Record<string, unknown> {
  const row = h.getConnection()
    .prepare(`
      SELECT payload_json
      FROM events
      WHERE aggregate_type = ? AND event_type = ?
      ORDER BY id DESC
      LIMIT 1
    `)
    .get(aggregate, eventType) as { payload_json: string } | undefined;
  if (!row) {
    throw new Error(`No ${eventType} event found for aggregate ${aggregate}`);
  }
  return JSON.parse(row.payload_json) as Record<string, unknown>;
}
