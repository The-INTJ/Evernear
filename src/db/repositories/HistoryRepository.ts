// Owns the domain event log, the ProseMirror step log, and checkpoint +
// replay. Every other repository holds a reference and calls appendEvent
// from inside its own mutation transactions. Keeping the write path
// centralized means aggregate_seq numbering stays consistent.

import { randomUUID } from "node:crypto";

import { Node as ProseMirrorNode } from "prosemirror-model";
import { schema as basicSchema } from "prosemirror-schema-basic";
import { Step } from "prosemirror-transform";

import {
  HARNESS_CONTENT_FORMAT,
  HARNESS_CONTENT_SCHEMA_VERSION,
  type JsonObject,
  type StoredDocumentSnapshot,
} from "../../shared/domain/document";
import {
  DEFAULT_STORY_DOCUMENT_TITLE,
  type HistorySummary,
} from "../../shared/domain/workspace";
import type { SqliteHarness } from "../sqliteHarness";
import { isoNow } from "../utils";
import { serializeNodePlainText } from "../../shared/anchoring";
import type {
  EventAggregateType,
  EventPayload,
  EventType,
} from "../events";
import type {
  RawCheckpointRow,
  RawEventCountRow,
  RawHistoryCountRow,
  RawStepRow,
} from "../rowTypes";

// Size of one "version tick" between implicit auto-checkpoints.
// Small enough to keep replay linear, large enough to avoid write bloat.
const CHECKPOINT_INTERVAL = 200;

export type AppendedEvent = {
  id: string;
  aggregateType: EventAggregateType;
  aggregateId: string;
  aggregateSeq: number;
  eventType: EventType;
  eventVersion: number;
  payloadJson: string;
  createdAt: string;
};

export type AppendStepsInput = {
  documentId: string;
  baseVersion: number;
  steps: JsonObject[];
  inverseSteps: JsonObject[];
};

export class HistoryRepository {
  constructor(private readonly sqlite: SqliteHarness) {}

  // ──────────────── event log ────────────────

  appendEvent<T extends EventType>(
    aggregateType: EventAggregateType,
    aggregateId: string,
    eventType: T,
    eventVersion: number,
    payload: EventPayload<T>,
  ): AppendedEvent {
    const database = this.sqlite.getConnection();
    const aggregateSeqRow = database.prepare(`
      SELECT COALESCE(MAX(aggregate_seq), 0) AS seq
      FROM events
      WHERE aggregate_type = ? AND aggregate_id = ?
    `).get(aggregateType, aggregateId) as { seq: number };

    const event: AppendedEvent = {
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

  // ──────────────── step log ────────────────

  appendDocumentSteps(input: AppendStepsInput): void {
    const database = this.sqlite.getConnection();
    const now = isoNow();
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
  }

  deleteDocumentHistory(documentId: string): void {
    const database = this.sqlite.getConnection();
    database.prepare("DELETE FROM document_steps WHERE document_id = ?").run(documentId);
    database.prepare("DELETE FROM document_checkpoints WHERE document_id = ?").run(documentId);
  }

  // ──────────────── checkpoints ────────────────

  shouldAutoCheckpoint(nextVersion: number): boolean {
    return nextVersion % CHECKPOINT_INTERVAL === 0;
  }

  ensureCheckpoint(snapshot: StoredDocumentSnapshot, label: string | null): void {
    this.sqlite.getConnection().prepare(`
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

  // Public for callers that want to take an explicit snapshot (user "save"
  // intent, document creation). Wraps the caller in its own transaction.
  writeCheckpoint(snapshot: StoredDocumentSnapshot, label: string | null): void {
    this.sqlite.runInTransaction(() => this.ensureCheckpoint(snapshot, label));
  }

  // ──────────────── replay ────────────────

  replayDocumentToVersion(documentId: string, targetVersion: number): StoredDocumentSnapshot {
    const database = this.sqlite.getConnection();
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

    let doc: ProseMirrorNode = basicSchema.nodeFromJSON(
      JSON.parse(checkpoint.content_json) as JsonObject,
    );
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

    const currentRow = database.prepare(`
      SELECT title, updated_at
      FROM documents
      WHERE id = ?
    `).get(documentId) as { title: string; updated_at: string } | undefined;

    return {
      id: documentId,
      title: currentRow?.title ?? DEFAULT_STORY_DOCUMENT_TITLE,
      contentFormat: HARNESS_CONTENT_FORMAT,
      contentSchemaVersion: HARNESS_CONTENT_SCHEMA_VERSION,
      contentJson: doc.toJSON() as JsonObject,
      plainText: serializeNodePlainText(doc),
      currentVersion: targetVersion,
      updatedAt: currentRow?.updated_at ?? checkpoint.created_at,
    };
  }

  // ──────────────── summaries ────────────────

  loadHistorySummary(documentId: string, currentVersion: number): HistorySummary {
    const database = this.sqlite.getConnection();
    const counts = database.prepare(`
      SELECT
        (SELECT COUNT(*) FROM document_steps WHERE document_id = ?) AS stepCount,
        (SELECT COUNT(*) FROM document_checkpoints WHERE document_id = ?) AS checkpointCount
    `).get(documentId, documentId) as RawHistoryCountRow;

    const eventCounts = database.prepare(`
      SELECT COUNT(*) AS eventCount
      FROM events
    `).get() as RawEventCountRow;

    return {
      currentVersion,
      stepCount: counts.stepCount,
      checkpointCount: counts.checkpointCount,
      eventCount: eventCounts.eventCount,
    };
  }
}
