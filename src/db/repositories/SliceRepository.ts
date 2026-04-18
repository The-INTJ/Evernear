import { schema as basicSchema } from "prosemirror-schema-basic";

import type { StoredDocumentSnapshot, JsonObject } from "../../shared/domain/document";
import type {
  AnchorResolutionResult,
  CreateSliceInput,
  EntitySliceRecord,
  SliceBoundaryRecord,
  SliceRecord,
} from "../../shared/domain/workspace";
import { createMappingFromSteps, mapBoundaryForward } from "../../shared/anchoring";
import type { SqliteHarness } from "../sqliteHarness";
import { isoNow, stableStringify, truncate } from "../utils";
import type {
  RawEntitySliceRow,
  RawSliceBoundaryRow,
  RawSliceRow,
} from "../rowTypes";
import {
  mapEntitySliceRow,
  mapSliceBoundaryRow,
  mapSliceRow,
} from "../rowMappers";
import type { HistoryRepository } from "./HistoryRepository";

export type CreateSliceResult = {
  sliceId: string;
  boundaryId: string;
  documentId: string;
  entityId: string;
};

export class SliceRepository {
  constructor(
    private readonly sqlite: SqliteHarness,
    private readonly history: HistoryRepository,
  ) {}

  // ──────────────── reads ────────────────

  loadSlices(projectId: string): SliceRecord[] {
    const rows = this.sqlite.getConnection().prepare(`
      SELECT id, project_id, document_id, boundary_id, title, excerpt, created_at, updated_at
      FROM slices
      WHERE project_id = ?
      ORDER BY updated_at DESC, created_at DESC
    `).all(projectId) as RawSliceRow[];
    return rows.map(mapSliceRow);
  }

  loadSliceBoundariesForProject(projectId: string): SliceBoundaryRecord[] {
    const rows = this.sqlite.getConnection().prepare(`
      SELECT
        slice_boundaries.id,
        slice_boundaries.slice_id,
        slice_boundaries.document_id,
        slice_boundaries.anchor_json,
        slice_boundaries.resolution_status,
        slice_boundaries.resolution_reason,
        slice_boundaries.created_at,
        slice_boundaries.updated_at
      FROM slice_boundaries
      INNER JOIN slices ON slices.id = slice_boundaries.slice_id
      WHERE slices.project_id = ?
      ORDER BY slice_boundaries.updated_at DESC
    `).all(projectId) as RawSliceBoundaryRow[];
    return rows.map(mapSliceBoundaryRow);
  }

  loadSliceBoundariesForDocument(documentId: string): SliceBoundaryRecord[] {
    const rows = this.sqlite.getConnection().prepare(`
      SELECT id, slice_id, document_id, anchor_json, resolution_status, resolution_reason, created_at, updated_at
      FROM slice_boundaries
      WHERE document_id = ?
      ORDER BY updated_at DESC
    `).all(documentId) as RawSliceBoundaryRow[];
    return rows.map(mapSliceBoundaryRow);
  }

  loadEntitySlices(projectId: string): EntitySliceRecord[] {
    const rows = this.sqlite.getConnection().prepare(`
      SELECT entity_slices.entity_id, entity_slices.slice_id, entity_slices.ordering
      FROM entity_slices
      INNER JOIN entities ON entities.id = entity_slices.entity_id
      WHERE entities.project_id = ?
      ORDER BY entity_slices.ordering ASC
    `).all(projectId) as RawEntitySliceRow[];
    return rows.map(mapEntitySliceRow);
  }

  // ──────────────── mutations ────────────────

  createSlice(
    input: CreateSliceInput,
    sliceId: string,
    boundaryId: string,
  ): CreateSliceResult {
    const now = isoNow();
    const excerpt = truncate(input.anchor.exact, 180);
    const resolution: AnchorResolutionResult = {
      status: "resolved",
      reason: "captured from committed slice placement",
      anchor: input.anchor,
    };

    this.sqlite.getConnection().prepare(`
      INSERT INTO slice_boundaries (
        id,
        slice_id,
        document_id,
        anchor_json,
        resolution_status,
        resolution_reason,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      boundaryId,
      sliceId,
      input.documentId,
      JSON.stringify(input.anchor),
      resolution.status,
      resolution.reason,
      now,
      now,
    );

    this.sqlite.getConnection().prepare(`
      INSERT INTO slices (
        id,
        project_id,
        document_id,
        boundary_id,
        title,
        excerpt,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sliceId,
      input.projectId,
      input.documentId,
      boundaryId,
      input.title.trim() || truncate(input.anchor.exact, 42),
      excerpt,
      now,
      now,
    );

    const ordering = this.nextEntitySliceOrdering(input.entityId);
    this.sqlite.getConnection().prepare(`
      INSERT INTO entity_slices (entity_id, slice_id, ordering)
      VALUES (?, ?, ?)
    `).run(input.entityId, sliceId, ordering);

    this.history.appendEvent("slice", sliceId, "sliceCreated", input.anchor.versionSeen, {
      entityId: input.entityId,
      title: input.title,
      documentId: input.documentId,
    });

    return { sliceId, boundaryId, documentId: input.documentId, entityId: input.entityId };
  }

  deleteSlice(sliceId: string): void {
    const database = this.sqlite.getConnection();
    database.prepare("DELETE FROM entity_slices WHERE slice_id = ?").run(sliceId);
    database.prepare("DELETE FROM slice_boundaries WHERE slice_id = ?").run(sliceId);
    database.prepare("DELETE FROM slices WHERE id = ?").run(sliceId);
  }

  // Called after a document transaction to re-anchor every boundary in that
  // document. Pure ProseMirror math is delegated to src/db/anchoring.ts —
  // this method owns persistence and the per-change event append.
  rewriteBoundariesAfterSteps(
    snapshot: StoredDocumentSnapshot,
    serializedSteps: JsonObject[],
  ): SliceBoundaryRecord[] {
    const boundaries = this.loadSliceBoundariesForDocument(snapshot.id);
    if (boundaries.length === 0 || serializedSteps.length === 0) {
      return boundaries;
    }

    const database = this.sqlite.getConnection();
    const nextDoc = basicSchema.nodeFromJSON(snapshot.contentJson);
    const mapping = createMappingFromSteps(serializedSteps);
    const updatedAt = isoNow();

    for (const boundary of boundaries) {
      const nextResolution = mapBoundaryForward(
        boundary.anchor,
        mapping,
        nextDoc,
        snapshot.currentVersion,
      );
      const changed =
        nextResolution.status !== boundary.resolution.status
        || nextResolution.reason !== boundary.resolution.reason
        || stableStringify(nextResolution.anchor) !== stableStringify(boundary.anchor);

      if (!changed) {
        continue;
      }

      database.prepare(`
        UPDATE slice_boundaries
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
        boundary.id,
      );

      this.history.appendEvent("sliceBoundary", boundary.id, "sliceBoundaryAutoResolved", snapshot.currentVersion, {
        sliceId: boundary.sliceId,
        status: nextResolution.status,
        reason: nextResolution.reason,
      });
    }

    return this.loadSliceBoundariesForDocument(snapshot.id);
  }

  deleteSlicesForDocument(documentId: string): void {
    // Build a list first so we can fan out through the same deletion path.
    const database = this.sqlite.getConnection();
    const sliceIds = database.prepare(`
      SELECT id
      FROM slices
      WHERE document_id = ?
    `).all(documentId) as Array<{ id: string }>;
    for (const { id } of sliceIds) {
      this.deleteSlice(id);
    }
  }

  slicesStillReferenced(sliceId: string): boolean {
    const row = this.sqlite.getConnection().prepare(`
      SELECT 1
      FROM entity_slices
      WHERE slice_id = ?
      LIMIT 1
    `).get(sliceId) as { 1: number } | undefined;
    return Boolean(row);
  }

  // ──────────────── private ────────────────

  private nextEntitySliceOrdering(entityId: string): number {
    const row = this.sqlite.getConnection().prepare(`
      SELECT COALESCE(MAX(ordering), -1) AS ordering
      FROM entity_slices
      WHERE entity_id = ?
    `).get(entityId) as { ordering: number };
    return row.ordering + 1;
  }
}
