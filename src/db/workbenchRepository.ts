import { randomUUID } from "node:crypto";

import type BetterSqlite3 from "better-sqlite3";
import { Node as ProseMirrorNode } from "prosemirror-model";
import { schema as basicSchema } from "prosemirror-schema-basic";
import { Mapping, Step } from "prosemirror-transform";

import {
  HARNESS_CONTENT_FORMAT,
  HARNESS_CONTENT_SCHEMA_VERSION,
  HARNESS_DOCUMENT_ID,
  HARNESS_DOCUMENT_TITLE,
  type JsonObject,
  type StoredDocumentSnapshot,
} from "../shared/domain/document";
import type {
  AnchorProbeRecord,
  AnchorResolutionResult,
  AnchorScenarioRun,
  ApplyDocumentTransactionInput,
  ApplyDocumentTransactionResult,
  BenchmarkCategory,
  BenchmarkRecord,
  CreateAnchorProbeInput,
  DeleteAnchorProbeInput,
  DeleteMatchingRuleInput,
  DocumentCheckpointRow,
  DocumentStepRow,
  EventRow,
  HistoryReplayResult,
  HistoryScenarioResult,
  HistorySummary,
  MatchingRuleRecord,
  MatchingScenarioResult,
  ReplaceDocumentHeadInput,
  TextAnchor,
  UpsertMatchingRuleInput,
  WorkbenchState,
} from "../shared/domain/workbench";
import { createEmptyHarnessSnapshot, createSmallWorkbenchFixture } from "../shared/domain/harnessFixture";
import { SqliteHarness } from "./sqliteHarness";

type RawDocumentRow = {
  id: string;
  title: string;
  content_format: string;
  content_schema_version: number;
  content_json: string;
  plain_text: string;
  current_version: number;
  updated_at: string;
};

type RawAnchorProbeRow = {
  id: string;
  kind: string;
  label: string;
  document_id: string;
  anchor_json: string;
  resolution_status: string;
  resolution_reason: string;
  updated_at: string;
};

type RawMatchingRuleRow = {
  id: string;
  label: string;
  kind: string;
  pattern: string;
  whole_word: number;
  allow_possessive: number;
  enabled: number;
  updated_at: string;
};

type RawBenchmarkRow = {
  id: string;
  category: string;
  payload_json: string;
  created_at: string;
};

type RawCheckpointRow = {
  document_id: string;
  version: number;
  content_format: string;
  content_schema_version: number;
  content_json: string;
  plain_text: string;
  label: string | null;
  created_at: string;
};

type RawStepRow = {
  id: string;
  document_id: string;
  version: number;
  step_json: string;
  inverse_step_json: string;
  created_at: string;
};

type RawHistoryCountRow = {
  stepCount: number;
  checkpointCount: number;
  eventCount: number;
};

type AnchorEventPayload = {
  kind: string;
  label: string;
  anchor: TextAnchor;
  resolution: AnchorResolutionResult;
};

type MatchingEventPayload = {
  label: string;
  kind: string;
  pattern: string;
  wholeWord: boolean;
  allowPossessive: boolean;
  enabled: boolean;
};

const CHECKPOINT_INTERVAL = 200;

export class WorkbenchRepository {
  constructor(private readonly sqliteHarness: SqliteHarness) {}

  ensureWorkbenchState(): WorkbenchState {
    return this.sqliteHarness.runInTransaction(() => {
      const snapshot = this.ensureDocumentHead();
      this.ensureCheckpoint(snapshot, "initial-head");
      return this.loadWorkbenchState();
    });
  }

  loadWorkbenchState(): WorkbenchState {
    return {
      snapshot: this.loadWorkbenchDocument(),
      anchorProbes: this.loadAnchorProbes(),
      matchingRules: this.loadMatchingRules(),
      historySummary: this.loadHistorySummary(),
      benchmarks: this.loadBenchmarks(),
    };
  }

  loadWorkbenchDocument(): StoredDocumentSnapshot | null {
    const database = this.sqliteHarness.getConnection();
    const row = database
      .prepare(`
        SELECT
          id,
          title,
          content_format,
          content_schema_version,
          content_json,
          plain_text,
          current_version,
          updated_at
        FROM documents
        WHERE id = ?
      `)
      .get(HARNESS_DOCUMENT_ID) as RawDocumentRow | undefined;

    return row ? mapDocumentRow(row) : null;
  }

  replaceDocumentHead(input: ReplaceDocumentHeadInput): WorkbenchState {
    return this.sqliteHarness.runInTransaction(() => {
      const database = this.sqliteHarness.getConnection();
      const now = isoNow();

      database.prepare("DELETE FROM document_steps WHERE document_id = ?").run(input.documentId);
      database.prepare("DELETE FROM document_checkpoints WHERE document_id = ?").run(input.documentId);
      database.prepare("DELETE FROM events").run();
      database.prepare("DELETE FROM anchor_probes").run();
      database.prepare("DELETE FROM matching_rules").run();
      database.prepare("DELETE FROM benchmark_results").run();

      database.prepare(`
        INSERT INTO documents (
          id,
          title,
          content_format,
          content_schema_version,
          content_json,
          plain_text,
          current_version,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          content_format = excluded.content_format,
          content_schema_version = excluded.content_schema_version,
          content_json = excluded.content_json,
          plain_text = excluded.plain_text,
          current_version = excluded.current_version,
          updated_at = excluded.updated_at
      `).run(
        input.documentId,
        input.title,
        HARNESS_CONTENT_FORMAT,
        HARNESS_CONTENT_SCHEMA_VERSION,
        JSON.stringify(input.contentJson),
        input.plainText,
        0,
        now,
      );

      const snapshot = this.loadWorkbenchDocument();
      if (!snapshot) {
        throw new Error("Expected a head document after replacement.");
      }

      this.ensureCheckpoint(snapshot, input.source);
      this.appendEvent("document", input.documentId, "documentHeadReplaced", 0, {
        title: input.title,
        source: input.source,
      });

      return this.loadWorkbenchState();
    });
  }

  applyDocumentTransaction(input: ApplyDocumentTransactionInput): ApplyDocumentTransactionResult {
    return this.sqliteHarness.runInTransaction(() => {
      const snapshot = this.loadWorkbenchDocument();
      if (!snapshot) {
        throw new Error("Cannot apply a document transaction without a head document.");
      }

      if (snapshot.currentVersion !== input.baseVersion) {
        throw new Error(`Version mismatch. Expected ${snapshot.currentVersion}, received ${input.baseVersion}.`);
      }

      const database = this.sqliteHarness.getConnection();
      const now = isoNow();
      const nextVersion = input.baseVersion + input.steps.length;

      for (let index = 0; index < input.steps.length; index += 1) {
        const version = input.baseVersion + index + 1;
        database.prepare(`
          INSERT INTO document_steps (
            id,
            document_id,
            version,
            step_json,
            inverse_step_json,
            created_at
          )
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          randomUUID(),
          input.documentId,
          version,
          JSON.stringify(input.steps[index]),
          JSON.stringify(input.inverseSteps[index] ?? {}),
          now,
        );
      }

      database.prepare(`
        UPDATE documents
        SET
          title = ?,
          content_json = ?,
          plain_text = ?,
          current_version = ?,
          updated_at = ?
        WHERE id = ?
      `).run(
        input.title,
        JSON.stringify(input.contentJson),
        input.plainText,
        nextVersion,
        now,
        input.documentId,
      );

      const updatedSnapshot = this.loadWorkbenchDocument();
      if (!updatedSnapshot) {
        throw new Error("Expected updated head document after transaction.");
      }

      if (input.saveIntent || nextVersion % CHECKPOINT_INTERVAL === 0) {
        this.ensureCheckpoint(updatedSnapshot, input.saveIntent ? "explicit-save" : `auto-${nextVersion}`);
      }

      const updatedProbes = this.updateAnchorProbesForHead(updatedSnapshot, input.steps);

      return {
        snapshot: updatedSnapshot,
        historySummary: this.loadHistorySummary(),
        anchorProbes: updatedProbes,
      };
    });
  }

  writeCheckpoint(label: string | null): StoredDocumentSnapshot {
    return this.sqliteHarness.runInTransaction(() => {
      const snapshot = this.requireHead();
      this.ensureCheckpoint(snapshot, label);
      return snapshot;
    });
  }

  createAnchorProbe(input: CreateAnchorProbeInput): AnchorProbeRecord {
    return this.sqliteHarness.runInTransaction(() => {
      const database = this.sqliteHarness.getConnection();
      const now = isoNow();
      const resolution: AnchorResolutionResult = {
        status: "resolved",
        reason: "captured from current selection",
        anchor: input.anchor,
      };

      const probe: AnchorProbeRecord = {
        id: randomUUID(),
        kind: input.kind,
        label: input.label,
        anchor: input.anchor,
        resolution,
        updatedAt: now,
      };

      database.prepare(`
        INSERT INTO anchor_probes (
          id,
          kind,
          label,
          document_id,
          anchor_json,
          resolution_status,
          resolution_reason,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        probe.id,
        probe.kind,
        probe.label,
        probe.anchor.documentId,
        JSON.stringify(probe.anchor),
        probe.resolution.status,
        probe.resolution.reason,
        probe.updatedAt,
      );

      this.appendEvent("anchorProbe", probe.id, "anchorProbeCreated", probe.anchor.versionSeen, {
        kind: probe.kind,
        label: probe.label,
        anchor: probe.anchor,
        resolution: probe.resolution,
      } satisfies AnchorEventPayload);

      return probe;
    });
  }

  deleteAnchorProbe(input: DeleteAnchorProbeInput): AnchorProbeRecord[] {
    return this.sqliteHarness.runInTransaction(() => {
      const current = this.loadAnchorProbes().find((probe) => probe.id === input.probeId);
      if (current) {
        this.appendEvent("anchorProbe", current.id, "anchorProbeDeleted", current.anchor.versionSeen, {
          label: current.label,
        });
      }

      this.sqliteHarness.getConnection().prepare("DELETE FROM anchor_probes WHERE id = ?").run(input.probeId);
      return this.loadAnchorProbes();
    });
  }

  upsertMatchingRule(input: UpsertMatchingRuleInput): MatchingRuleRecord[] {
    return this.sqliteHarness.runInTransaction(() => {
      const database = this.sqliteHarness.getConnection();
      const now = isoNow();
      const id = input.id ?? randomUUID();
      const eventVersion = this.requireHead().currentVersion;

      database.prepare(`
        INSERT INTO matching_rules (
          id,
          label,
          kind,
          pattern,
          whole_word,
          allow_possessive,
          enabled,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          label = excluded.label,
          kind = excluded.kind,
          pattern = excluded.pattern,
          whole_word = excluded.whole_word,
          allow_possessive = excluded.allow_possessive,
          enabled = excluded.enabled,
          updated_at = excluded.updated_at
      `).run(
        id,
        input.label,
        input.kind,
        input.pattern,
        boolToInt(input.wholeWord),
        boolToInt(input.allowPossessive),
        boolToInt(input.enabled),
        now,
      );

      this.appendEvent("matchingRule", id, input.id ? "matchingRuleUpdated" : "matchingRuleCreated", eventVersion, {
        label: input.label,
        kind: input.kind,
        pattern: input.pattern,
        wholeWord: input.wholeWord,
        allowPossessive: input.allowPossessive,
        enabled: input.enabled,
      } satisfies MatchingEventPayload);

      return this.loadMatchingRules();
    });
  }

  deleteMatchingRule(input: DeleteMatchingRuleInput): MatchingRuleRecord[] {
    return this.sqliteHarness.runInTransaction(() => {
      const rule = this.loadMatchingRules().find((candidate) => candidate.id === input.ruleId);
      if (rule) {
        this.appendEvent("matchingRule", rule.id, "matchingRuleDeleted", this.requireHead().currentVersion, {
          label: rule.label,
        });
      }

      this.sqliteHarness.getConnection().prepare("DELETE FROM matching_rules WHERE id = ?").run(input.ruleId);
      return this.loadMatchingRules();
    });
  }

  replayDocumentToVersion(targetVersion: number): HistoryReplayResult {
    const head = this.requireHead();
    const replayedSnapshot = replaySnapshotToVersion(this.sqliteHarness.getConnection(), head.id, targetVersion);
    return {
      snapshot: replayedSnapshot,
      anchorResolutions: this.replayAnchorProbesAtVersion(targetVersion, replayedSnapshot),
    };
  }

  rebuildProjectionsFromHistory(): HistoryScenarioResult {
    const head = this.requireHead();
    const replayed = replaySnapshotToVersion(this.sqliteHarness.getConnection(), head.id, head.currentVersion);
    const rulesFromEvents = rebuildMatchingRulesFromEvents(this.loadEventRows("matchingRule"));
    const probesFromEvents = rebuildAnchorProbesFromEvents(this.loadEventRows("anchorProbe"));

    const currentRules = this.loadMatchingRules();
    const currentProbes = this.loadAnchorProbes();

    return {
      ranAt: isoNow(),
      replayMatchesHead:
        replayed.plainText === head.plainText
        && JSON.stringify(replayed.contentJson) === JSON.stringify(head.contentJson),
      rebuildMatchesHead:
        stableStringify(rulesFromEvents) === stableStringify(currentRules)
        && stableStringify(probesFromEvents) === stableStringify(currentProbes),
      currentVersion: head.currentVersion,
      checkpointCount: this.loadHistorySummary().checkpointCount,
    };
  }

  recordBenchmark(category: BenchmarkCategory, payload: JsonObject): BenchmarkRecord {
    return this.sqliteHarness.runInTransaction(() => {
      const benchmark: BenchmarkRecord = {
        id: randomUUID(),
        category,
        payload,
        createdAt: isoNow(),
      };

      this.sqliteHarness.getConnection().prepare(`
        INSERT INTO benchmark_results (
          id,
          category,
          payload_json,
          created_at
        )
        VALUES (?, ?, ?, ?)
      `).run(benchmark.id, benchmark.category, JSON.stringify(benchmark.payload), benchmark.createdAt);

      return benchmark;
    });
  }

  loadBenchmarks(limit = 20): BenchmarkRecord[] {
    const rows = this.sqliteHarness.getConnection().prepare(`
      SELECT id, category, payload_json, created_at
      FROM benchmark_results
      ORDER BY created_at DESC
      LIMIT ?
    `).all(limit) as RawBenchmarkRow[];

    return rows.map((row) => ({
      id: row.id,
      category: row.category as BenchmarkCategory,
      payload: JSON.parse(row.payload_json) as JsonObject,
      createdAt: row.created_at,
    }));
  }

  runAnchorScenarios(): AnchorScenarioRun {
    const source = buildDocFromParagraphs([
      "Northbound lanterns drifted over the marsh road.",
      "Aurelia Vale copied White Harbor twice to test duplicates.",
    ]);
    const anchor = buildAnchorFromRange(source, 1, 20, HARNESS_DOCUMENT_ID, 0);
    const duplicateDoc = buildDocFromParagraphs([
      "Northbound lanterns drifted over the marsh road.",
      "Northbound lanterns drifted over the marsh road.",
    ]);
    const duplicateResolution = resolveAnchorWithFallback(anchor, duplicateDoc, "range collapsed");
    const editedDoc = buildDocFromParagraphs([
      "Northbound paper lanterns drifted over the marsh road.",
      "Aurelia Vale copied White Harbor twice to test duplicates.",
    ]);
    const repairedResolution = resolveAnchorWithFallback(anchor, editedDoc, "text shifted");
    const removedDoc = buildDocFromParagraphs([
      "Lantern hooks remained but the text was removed.",
      "Aurelia Vale copied White Harbor twice to test duplicates.",
    ]);
    const invalidResolution = resolveAnchorWithFallback(anchor, removedDoc, "text deleted");

    return {
      ranAt: isoNow(),
      cases: [
        {
          id: "anchor-repair",
          label: "Exact text with nearby edit repairs cleanly",
          status: repairedResolution.status,
          reason: repairedResolution.reason,
        },
        {
          id: "anchor-ambiguous",
          label: "Duplicate text fails closed as ambiguous",
          status: duplicateResolution.status,
          reason: duplicateResolution.reason,
        },
        {
          id: "anchor-invalid",
          label: "Deleted text becomes invalid",
          status: invalidResolution.status,
          reason: invalidResolution.reason,
        },
      ],
    };
  }

  runMatchingScenarios(): MatchingScenarioResult {
    const cases = [
      {
        id: "literal-whole-word",
        label: "Whole-word literal ignores embedded substrings",
        text: "White Harbor sat beside the tidewhiteharbor marker.",
        rules: [
          {
            id: "r1",
            label: "White Harbor",
            kind: "literal",
            pattern: "White Harbor",
            wholeWord: true,
            allowPossessive: true,
            enabled: true,
            updatedAt: isoNow(),
          },
        ] satisfies MatchingRuleRecord[],
        expectedLabels: ["White Harbor"],
      },
      {
        id: "possessive-alias",
        label: "Possessive alias still matches",
        text: "Aurelia's notebook sat near the ferry ropes.",
        rules: [
          {
            id: "r2",
            label: "Aurelia",
            kind: "alias",
            pattern: "Aurelia",
            wholeWord: true,
            allowPossessive: true,
            enabled: true,
            updatedAt: isoNow(),
          },
        ] satisfies MatchingRuleRecord[],
        expectedLabels: ["Aurelia"],
      },
      {
        id: "regex-short-name",
        label: "Regex can catch chapter-style markers",
        text: "Part 1\n\nChapter 1",
        rules: [
          {
            id: "r3",
            label: "Chapter marker",
            kind: "regex",
            pattern: "Chapter\\s+\\d+",
            wholeWord: false,
            allowPossessive: false,
            enabled: true,
            updatedAt: isoNow(),
          },
        ] satisfies MatchingRuleRecord[],
        expectedLabels: ["Chapter marker"],
      },
    ];

    return {
      ranAt: isoNow(),
      cases: cases.map((scenario) => {
        const hits = collectRuleMatches(
          scenario.text,
          scenario.rules,
          { from: 0, to: scenario.text.length },
        );
        const labels = uniqueSorted(hits.map((hit) => hit.label));
        return {
          id: scenario.id,
          label: scenario.label,
          pass: stableStringify(labels) === stableStringify(uniqueSorted(scenario.expectedLabels)),
          matchLabels: labels,
        };
      }),
    };
  }

  runHistoryScenario(): HistoryScenarioResult {
    return this.rebuildProjectionsFromHistory();
  }

  loadSmallFixture(): WorkbenchState {
    const fixture = createSmallWorkbenchFixture();
    return this.replaceDocumentHead({
      documentId: HARNESS_DOCUMENT_ID,
      title: `${HARNESS_DOCUMENT_TITLE} (Small Fixture)`,
      contentJson: fixture.contentJson,
      plainText: fixture.plainText,
      source: "small-fixture",
    });
  }

  private ensureDocumentHead(): StoredDocumentSnapshot {
    const existing = this.loadWorkbenchDocument();
    if (existing) {
      return existing;
    }

    const empty = createEmptyHarnessSnapshot();
    const now = isoNow();
    this.sqliteHarness.getConnection().prepare(`
      INSERT INTO documents (
        id,
        title,
        content_format,
        content_schema_version,
        content_json,
        plain_text,
        current_version,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      empty.id,
      empty.title,
      empty.contentFormat,
      empty.contentSchemaVersion,
      JSON.stringify(empty.contentJson),
      empty.plainText,
      0,
      now,
    );

    return this.requireHead();
  }

  private ensureCheckpoint(snapshot: StoredDocumentSnapshot, label: string | null): void {
    this.sqliteHarness.getConnection().prepare(`
      INSERT OR REPLACE INTO document_checkpoints (
        document_id,
        version,
        content_format,
        content_schema_version,
        content_json,
        plain_text,
        label,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      snapshot.id,
      snapshot.currentVersion,
      snapshot.contentFormat,
      snapshot.contentSchemaVersion,
      JSON.stringify(snapshot.contentJson),
      snapshot.plainText,
      label,
      isoNow(),
    );
  }

  private requireHead(): StoredDocumentSnapshot {
    const snapshot = this.loadWorkbenchDocument();
    if (!snapshot) {
      throw new Error("Workbench document head is missing.");
    }

    return snapshot;
  }

  private loadAnchorProbes(): AnchorProbeRecord[] {
    const rows = this.sqliteHarness.getConnection().prepare(`
      SELECT
        id,
        kind,
        label,
        document_id,
        anchor_json,
        resolution_status,
        resolution_reason,
        updated_at
      FROM anchor_probes
      ORDER BY updated_at DESC
    `).all() as RawAnchorProbeRow[];

    return rows.map((row) => {
      const anchor = JSON.parse(row.anchor_json) as TextAnchor;
      return {
        id: row.id,
        kind: row.kind as AnchorProbeRecord["kind"],
        label: row.label,
        anchor,
        resolution: {
          status: row.resolution_status as AnchorResolutionResult["status"],
          reason: row.resolution_reason,
          anchor,
        },
        updatedAt: row.updated_at,
      };
    });
  }

  private loadMatchingRules(): MatchingRuleRecord[] {
    const rows = this.sqliteHarness.getConnection().prepare(`
      SELECT
        id,
        label,
        kind,
        pattern,
        whole_word,
        allow_possessive,
        enabled,
        updated_at
      FROM matching_rules
      ORDER BY updated_at DESC
    `).all() as RawMatchingRuleRow[];

    return rows.map((row) => ({
      id: row.id,
      label: row.label,
      kind: row.kind as MatchingRuleRecord["kind"],
      pattern: row.pattern,
      wholeWord: intToBool(row.whole_word),
      allowPossessive: intToBool(row.allow_possessive),
      enabled: intToBool(row.enabled),
      updatedAt: row.updated_at,
    }));
  }

  private loadHistorySummary(): HistorySummary {
    const snapshot = this.loadWorkbenchDocument();
    const row = this.sqliteHarness.getConnection().prepare(`
      SELECT
        (SELECT COUNT(*) FROM document_steps WHERE document_id = @documentId) AS stepCount,
        (SELECT COUNT(*) FROM document_checkpoints WHERE document_id = @documentId) AS checkpointCount,
        (SELECT COUNT(*) FROM events) AS eventCount
    `).get({
      documentId: HARNESS_DOCUMENT_ID,
    }) as RawHistoryCountRow;

    return {
      currentVersion: snapshot?.currentVersion ?? 0,
      stepCount: row.stepCount,
      checkpointCount: row.checkpointCount,
      eventCount: row.eventCount,
    };
  }

  private updateAnchorProbesForHead(
    snapshot: StoredDocumentSnapshot,
    serializedSteps: JsonObject[],
  ): AnchorProbeRecord[] {
    const probes = this.loadAnchorProbes();
    if (probes.length === 0 || serializedSteps.length === 0) {
      return probes;
    }

    const database = this.sqliteHarness.getConnection();
    const nextDoc = basicSchema.nodeFromJSON(snapshot.contentJson);
    const mapping = createMappingFromSteps(serializedSteps);
    const updatedAt = isoNow();

    for (const probe of probes) {
      const nextResolution = mapAnchorForward(probe.anchor, mapping, nextDoc);
      const changed =
        nextResolution.status !== probe.resolution.status
        || nextResolution.reason !== probe.resolution.reason
        || stableStringify(nextResolution.anchor) !== stableStringify(probe.anchor);

      if (!changed) {
        continue;
      }

      database.prepare(`
        UPDATE anchor_probes
        SET
          anchor_json = ?,
          resolution_status = ?,
          resolution_reason = ?,
          updated_at = ?
        WHERE id = ?
      `).run(
        JSON.stringify(nextResolution.anchor),
        nextResolution.status,
        nextResolution.reason,
        updatedAt,
        probe.id,
      );

      this.appendEvent("anchorProbe", probe.id, "anchorProbeAutoResolved", snapshot.currentVersion, {
        kind: probe.kind,
        label: probe.label,
        anchor: nextResolution.anchor,
        resolution: nextResolution,
      } satisfies AnchorEventPayload);
    }

    return this.loadAnchorProbes();
  }

  private appendEvent(
    aggregateType: string,
    aggregateId: string,
    eventType: string,
    eventVersion: number,
    payload: JsonObject,
  ): EventRow {
    const database = this.sqliteHarness.getConnection();
    const aggregateSeqRow = database.prepare(`
      SELECT COALESCE(MAX(aggregate_seq), 0) AS seq
      FROM events
      WHERE aggregate_type = ? AND aggregate_id = ?
    `).get(aggregateType, aggregateId) as { seq: number };

    const event: EventRow = {
      id: randomUUID(),
      aggregateType,
      aggregateId,
      aggregateSeq: aggregateSeqRow.seq + 1,
      eventType,
      eventVersion,
      payloadJson: JSON.stringify(payload),
      createdAt: isoNow(),
    };

    database.prepare(`
      INSERT INTO events (
        id,
        aggregate_type,
        aggregate_id,
        aggregate_seq,
        event_type,
        event_version,
        payload_json,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      event.id,
      event.aggregateType,
      event.aggregateId,
      event.aggregateSeq,
      event.eventType,
      event.eventVersion,
      event.payloadJson,
      event.createdAt,
    );

    return event;
  }

  private loadEventRows(aggregateType: string): EventRow[] {
    const rows = this.sqliteHarness.getConnection().prepare(`
      SELECT
        id,
        aggregate_type,
        aggregate_id,
        aggregate_seq,
        event_type,
        event_version,
        payload_json,
        created_at
      FROM events
      WHERE aggregate_type = ?
      ORDER BY aggregate_id ASC, aggregate_seq ASC
    `).all(aggregateType) as Array<{
      id: string;
      aggregate_type: string;
      aggregate_id: string;
      aggregate_seq: number;
      event_type: string;
      event_version: number;
      payload_json: string;
      created_at: string;
    }>;

    return rows.map((row) => ({
      id: row.id,
      aggregateType: row.aggregate_type,
      aggregateId: row.aggregate_id,
      aggregateSeq: row.aggregate_seq,
      eventType: row.event_type,
      eventVersion: row.event_version,
      payloadJson: row.payload_json,
      createdAt: row.created_at,
    }));
  }

  private replayAnchorProbesAtVersion(
    targetVersion: number,
    snapshot: StoredDocumentSnapshot,
  ): AnchorProbeRecord[] {
    const database = this.sqliteHarness.getConnection();
    const groupedEvents = groupEventsByAggregate(this.loadEventRows("anchorProbe"));
    const targetDoc = basicSchema.nodeFromJSON(snapshot.contentJson);

    return groupedEvents.flatMap((events) => {
      const latestBeforeTarget = latestEventAtOrBefore(events, targetVersion);
      if (!latestBeforeTarget || latestBeforeTarget.eventType === "anchorProbeDeleted") {
        return [];
      }

      const payload = JSON.parse(latestBeforeTarget.payloadJson) as AnchorEventPayload;
      const steps = loadSerializedStepsBetween(
        database,
        HARNESS_DOCUMENT_ID,
        payload.anchor.versionSeen,
        targetVersion,
      );
      const resolution = mapAnchorForward(payload.anchor, createMappingFromSteps(steps), targetDoc);

      return [{
        id: latestBeforeTarget.aggregateId,
        kind: payload.kind as AnchorProbeRecord["kind"],
        label: payload.label,
        anchor: resolution.anchor,
        resolution,
        updatedAt: latestBeforeTarget.createdAt,
      }];
    });
  }
}

function mapDocumentRow(row: RawDocumentRow): StoredDocumentSnapshot {
  return {
    id: row.id,
    title: row.title,
    contentFormat: row.content_format,
    contentSchemaVersion: row.content_schema_version,
    contentJson: JSON.parse(row.content_json) as StoredDocumentSnapshot["contentJson"],
    plainText: row.plain_text,
    currentVersion: row.current_version,
    updatedAt: row.updated_at,
  };
}

function replaySnapshotToVersion(
  database: BetterSqlite3.Database,
  documentId: string,
  targetVersion: number,
): StoredDocumentSnapshot {
  const checkpoint = database.prepare(`
    SELECT
      document_id,
      version,
      content_format,
      content_schema_version,
      content_json,
      plain_text,
      label,
      created_at
    FROM document_checkpoints
    WHERE document_id = ?
      AND version <= ?
    ORDER BY version DESC
    LIMIT 1
  `).get(documentId, targetVersion) as RawCheckpointRow | undefined;

  if (!checkpoint) {
    throw new Error(`No checkpoint found at or before version ${targetVersion}.`);
  }

  let doc = basicSchema.nodeFromJSON(JSON.parse(checkpoint.content_json) as JsonObject);
  const stepRows = database.prepare(`
    SELECT id, document_id, version, step_json, inverse_step_json, created_at
    FROM document_steps
    WHERE document_id = ?
      AND version > ?
      AND version <= ?
    ORDER BY version ASC
  `).all(documentId, checkpoint.version, targetVersion) as RawStepRow[];

  for (const row of stepRows) {
    const step = Step.fromJSON(basicSchema, JSON.parse(row.step_json) as JsonObject);
    const result = step.apply(doc);
    if (result.failed) {
      throw new Error(`Failed to replay step ${row.id}: ${result.failed}`);
    }
    doc = result.doc!;
  }

  return {
    id: documentId,
    title: HARNESS_DOCUMENT_TITLE,
    contentFormat: HARNESS_CONTENT_FORMAT,
    contentSchemaVersion: HARNESS_CONTENT_SCHEMA_VERSION,
    contentJson: doc.toJSON() as JsonObject,
    plainText: serializeNodePlainText(doc),
    currentVersion: targetVersion,
    updatedAt: checkpoint.created_at,
  };
}

function createMappingFromSteps(serializedSteps: JsonObject[]): Mapping {
  const mapping = new Mapping();
  for (const serializedStep of serializedSteps) {
    const step = Step.fromJSON(basicSchema, serializedStep);
    mapping.appendMap(step.getMap());
  }
  return mapping;
}

function mapAnchorForward(
  anchor: TextAnchor,
  mapping: Mapping,
  nextDoc: ProseMirrorNode,
): AnchorResolutionResult {
  const mappedFrom = mapping.map(anchor.from, 1);
  const mappedTo = mapping.map(anchor.to, -1);

  if (mappedFrom < mappedTo) {
    const mappedExact = nextDoc.textBetween(mappedFrom, mappedTo, "\n\n");
    if (mappedExact === anchor.exact) {
      return {
        status: "resolved",
        reason: "mapped forward through document steps",
        anchor: {
          ...anchor,
          from: mappedFrom,
          to: mappedTo,
        },
      };
    }
  }

  return resolveAnchorWithFallback(anchor, nextDoc, "mapping no longer matched exact text");
}

function resolveAnchorWithFallback(
  anchor: TextAnchor,
  nextDoc: ProseMirrorNode,
  fallbackReason: string,
): AnchorResolutionResult {
  const index = buildPlainTextIndex(nextDoc);
  const exact = anchor.exact;
  const candidates: Array<{
    startOffset: number;
    score: number;
  }> = [];

  let searchIndex = 0;
  while (searchIndex <= index.text.length) {
    const foundAt = index.text.indexOf(exact, searchIndex);
    if (foundAt === -1) {
      break;
    }

    const prefixSlice = index.text.slice(Math.max(0, foundAt - anchor.prefix.length), foundAt);
    const suffixSlice = index.text.slice(foundAt + exact.length, foundAt + exact.length + anchor.suffix.length);
    const prefixMatch = anchor.prefix.length === 0 || prefixSlice.endsWith(anchor.prefix);
    const suffixMatch = anchor.suffix.length === 0 || suffixSlice.startsWith(anchor.suffix);
    const proximityScore = anchor.approxPlainTextOffset === undefined
      ? 0
      : Math.max(0, 50 - Math.abs(foundAt - anchor.approxPlainTextOffset)) / 100;

    candidates.push({
      startOffset: foundAt,
      score: (prefixMatch ? 3 : 0) + (suffixMatch ? 3 : 0) + proximityScore,
    });
    searchIndex = foundAt + Math.max(1, exact.length);
  }

  if (candidates.length === 0) {
    return {
      status: "invalid",
      reason: `${fallbackReason}; exact text no longer exists`,
      anchor,
    };
  }

  candidates.sort((left, right) => right.score - left.score);
  const best = candidates[0];
  const second = candidates[1];

  if (second && Math.abs(best.score - second.score) < 0.25) {
    return {
      status: "ambiguous",
      reason: `${fallbackReason}; multiple plausible matches remained`,
      anchor,
    };
  }

  const from = offsetToPosition(index, best.startOffset);
  const to = offsetToPosition(index, best.startOffset + Math.max(exact.length - 1, 0), true);
  if (from === null || to === null || from >= to) {
    return {
      status: "invalid",
      reason: `${fallbackReason}; could not map repaired text back to document positions`,
      anchor,
    };
  }

  return {
    status: "repaired",
    reason: `${fallbackReason}; exact text plus context repaired the range`,
    anchor: {
      ...anchor,
      from,
      to,
    },
  };
}

function buildPlainTextIndex(doc: ProseMirrorNode): {
  text: string;
  charStarts: number[];
  charEnds: number[];
} {
  const textParts: string[] = [];
  const charStarts: number[] = [];
  const charEnds: number[] = [];

  doc.forEach((blockNode, offset, index) => {
    const blockStartPos = offset + 1;
    if (index > 0) {
      const separatorPos = blockStartPos - 1;
      for (let i = 0; i < 2; i += 1) {
        textParts.push("\n");
        charStarts.push(separatorPos);
        charEnds.push(separatorPos);
      }
    }

    walkNodeText(blockNode, blockStartPos, textParts, charStarts, charEnds);
  });

  return {
    text: textParts.join(""),
    charStarts,
    charEnds,
  };
}

function walkNodeText(
  node: ProseMirrorNode,
  absolutePos: number,
  textParts: string[],
  charStarts: number[],
  charEnds: number[],
): void {
  if (node.isText) {
    const text = node.text ?? "";
    for (let index = 0; index < text.length; index += 1) {
      textParts.push(text[index] ?? "");
      charStarts.push(absolutePos + index);
      charEnds.push(absolutePos + index + 1);
    }
    return;
  }

  node.forEach((child, offset) => {
    walkNodeText(child, absolutePos + offset + 1, textParts, charStarts, charEnds);
  });
}

function offsetToPosition(
  index: ReturnType<typeof buildPlainTextIndex>,
  plainOffset: number,
  useEnd = false,
): number | null {
  if (plainOffset < 0) {
    return null;
  }

  if (plainOffset >= index.charStarts.length) {
    const finalEnd = index.charEnds[index.charEnds.length - 1];
    return finalEnd ?? null;
  }

  return useEnd ? index.charEnds[plainOffset] ?? null : index.charStarts[plainOffset] ?? null;
}

function buildDocFromParagraphs(paragraphs: string[]): ProseMirrorNode {
  return basicSchema.node("doc", null, paragraphs.map((paragraph) =>
    basicSchema.node("paragraph", null, paragraph.length > 0 ? [basicSchema.text(paragraph)] : []),
  ));
}

function buildAnchorFromRange(
  doc: ProseMirrorNode,
  from: number,
  to: number,
  documentId: string,
  versionSeen: number,
): TextAnchor {
  const index = buildPlainTextIndex(doc);
  const exact = doc.textBetween(from, to, "\n\n");
  const prefix = doc.textBetween(Math.max(1, from - 24), from, "\n\n");
  const suffix = doc.textBetween(to, Math.min(doc.content.size, to + 24), "\n\n");
  return {
    documentId,
    from,
    to,
    exact,
    prefix,
    suffix,
    blockPath: resolveBlockPath(doc, from),
    approxPlainTextOffset: index.text.indexOf(exact),
    versionSeen,
  };
}

function resolveBlockPath(doc: ProseMirrorNode, position: number): number[] {
  const resolved = doc.resolve(position);
  const indices: number[] = [];
  for (let depth = 0; depth <= resolved.depth; depth += 1) {
    indices.push(resolved.index(depth));
  }
  return indices;
}

function serializeNodePlainText(doc: ProseMirrorNode): string {
  return doc.textBetween(0, doc.content.size, "\n\n");
}

function loadSerializedStepsBetween(
  database: BetterSqlite3.Database,
  documentId: string,
  fromVersion: number,
  toVersion: number,
): JsonObject[] {
  const rows = database.prepare(`
    SELECT step_json
    FROM document_steps
    WHERE document_id = ?
      AND version > ?
      AND version <= ?
    ORDER BY version ASC
  `).all(documentId, fromVersion, toVersion) as Array<{ step_json: string }>;

  return rows.map((row) => JSON.parse(row.step_json) as JsonObject);
}

function rebuildMatchingRulesFromEvents(events: EventRow[]): MatchingRuleRecord[] {
  const grouped = groupEventsByAggregate(events);
  const rules: MatchingRuleRecord[] = [];

  for (const eventList of grouped) {
    const latest = eventList[eventList.length - 1];
    if (!latest || latest.eventType === "matchingRuleDeleted") {
      continue;
    }

    const payload = JSON.parse(latest.payloadJson) as MatchingEventPayload;
    rules.push({
      id: latest.aggregateId,
      label: payload.label,
      kind: payload.kind as MatchingRuleRecord["kind"],
      pattern: payload.pattern,
      wholeWord: payload.wholeWord,
      allowPossessive: payload.allowPossessive,
      enabled: payload.enabled,
      updatedAt: latest.createdAt,
    });
  }

  return rules.sort((left, right) => left.id.localeCompare(right.id));
}

function rebuildAnchorProbesFromEvents(events: EventRow[]): AnchorProbeRecord[] {
  const grouped = groupEventsByAggregate(events);
  const probes: AnchorProbeRecord[] = [];

  for (const eventList of grouped) {
    const latest = eventList[eventList.length - 1];
    if (!latest || latest.eventType === "anchorProbeDeleted") {
      continue;
    }

    const payload = JSON.parse(latest.payloadJson) as AnchorEventPayload;
    probes.push({
      id: latest.aggregateId,
      kind: payload.kind as AnchorProbeRecord["kind"],
      label: payload.label,
      anchor: payload.anchor,
      resolution: payload.resolution,
      updatedAt: latest.createdAt,
    });
  }

  return probes.sort((left, right) => left.id.localeCompare(right.id));
}

function latestEventAtOrBefore(events: EventRow[], version: number): EventRow | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (events[index]?.eventVersion <= version) {
      return events[index] ?? null;
    }
  }

  return null;
}

function groupEventsByAggregate(events: EventRow[]): EventRow[][] {
  const groups = new Map<string, EventRow[]>();
  for (const event of events) {
    const key = `${event.aggregateType}:${event.aggregateId}`;
    const bucket = groups.get(key) ?? [];
    bucket.push(event);
    groups.set(key, bucket);
  }

  return [...groups.values()];
}

function collectRuleMatches(
  sourceText: string,
  rules: MatchingRuleRecord[],
  visibleRange: { from: number; to: number },
): Array<{ label: string }> {
  const visibleText = sourceText.slice(visibleRange.from, visibleRange.to);
  const normalizedVisible = normalizeForMatch(visibleText);
  const hits: Array<{ label: string }> = [];

  for (const rule of rules) {
    if (!rule.enabled) {
      continue;
    }

    if (rule.kind === "regex") {
      const regex = new RegExp(rule.pattern, "giu");
      if (regex.test(visibleText)) {
        hits.push({ label: rule.label });
      }
      continue;
    }

    const normalizedRule = normalizeForMatch(rule.pattern);
    let searchIndex = 0;
    while (searchIndex < normalizedVisible.length) {
      const foundAt = normalizedVisible.indexOf(normalizedRule, searchIndex);
      if (foundAt === -1) {
        break;
      }

      const before = normalizedVisible[foundAt - 1] ?? " ";
      const after = normalizedVisible[foundAt + normalizedRule.length] ?? " ";
      const possessiveSuffix = normalizedVisible.slice(
        foundAt + normalizedRule.length,
        foundAt + normalizedRule.length + 2,
      );
      const wholeWordOkay = !rule.wholeWord || (!isWordCharacter(before) && !isWordCharacter(after));
      const possessiveOkay = !rule.allowPossessive || possessiveSuffix === "'s" || possessiveSuffix === "";

      if (wholeWordOkay && possessiveOkay) {
        hits.push({ label: rule.label });
      }

      searchIndex = foundAt + Math.max(1, normalizedRule.length);
    }
  }

  return hits;
}

function normalizeForMatch(input: string): string {
  return input
    .normalize("NFKC")
    .replace(/[\u2019']/g, "'")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase();
}

function isWordCharacter(character: string): boolean {
  return /[\p{L}\p{N}_]/u.test(character);
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, nestedValue) => {
    if (nestedValue && typeof nestedValue === "object" && !Array.isArray(nestedValue)) {
      return Object.fromEntries(
        Object.entries(nestedValue as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)),
      );
    }
    return nestedValue;
  });
}

function boolToInt(value: boolean): number {
  return value ? 1 : 0;
}

function intToBool(value: number): boolean {
  return value === 1;
}

function isoNow(): string {
  return new Date().toISOString();
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
