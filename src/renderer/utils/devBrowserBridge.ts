// Dev-only in-memory stand-in for `window.evernear`. Only installed by
// main.tsx when the preload bridge is absent — i.e. when the renderer is
// previewed via `npm run dev:renderer` in a plain browser, outside the
// Electron shell. It simulates enough of the repository (documents,
// entities, rules, slices, anchor remapping) to exercise the real UI
// flows; nothing persists past a reload.
//
// This is *not* wired into the Electron build. When contextBridge has
// exposed `window.evernear`, main.tsx leaves it alone.

import { schema as basicSchema } from "prosemirror-schema-basic";

import type { HarnessBridge } from "../../shared/contracts/harnessApi";
import type {
  ApplyDocumentTransactionInput,
  ApplyDocumentTransactionResult,
  MatchingRuleInput,
  MatchingRuleRecord,
  SliceBoundaryRecord,
  WorkspaceState,
  WorkspaceStatus,
} from "../../shared/domain/workspace";
import { createMappingFromSteps, mapBoundaryForward } from "../../shared/anchoring";
import { buildDevSeed, buildDevSnapshot, nowIso } from "./devBrowserSeed";

const STATUS: WorkspaceStatus = {
  dbPath: "(browser-mode — no DB)",
  contentFormat: "prosemirror-basic",
  contentSchemaVersion: 1,
  synchronousMode: "NORMAL",
  storageEngine: "in-memory (browser)",
};

export function installDevBrowserBridge(): void {
  if (typeof window === "undefined") return;
  const existing = (window as unknown as { evernear?: HarnessBridge }).evernear;
  if (existing) return;

  const seed = buildDevSeed();
  let workspace = seed.workspace;
  const snapshots = seed.snapshots;
  let nextId = 1;
  const newId = (prefix: string) => `${prefix}-${nextId++}`;

  const commit = (next: WorkspaceState): WorkspaceState => {
    const activeId = next.layout.activeDocumentId;
    workspace = { ...next, activeDocument: activeId ? snapshots.get(activeId) ?? null : null };
    return workspace;
  };

  const rulesFrom = (entityId: string, rules: MatchingRuleInput[], existing: MatchingRuleRecord[]) => {
    const timestamp = nowIso();
    const seen = new Set<string>();
    return rules.flatMap((rule) => {
      if (seen.has(rule.pattern)) return [];
      seen.add(rule.pattern);
      const kept = existing.find((candidate) => candidate.pattern === rule.pattern);
      return [{
        id: kept?.id ?? newId("dev-rule"),
        entityId,
        label: rule.pattern,
        pattern: rule.pattern,
        enabled: rule.enabled,
        createdAt: kept?.createdAt ?? timestamp,
        updatedAt: timestamp,
      }];
    });
  };

  const removeSlices = (sliceIds: Set<string>): Partial<WorkspaceState> => ({
    slices: workspace.slices.filter((slice) => !sliceIds.has(slice.id)),
    sliceBoundaries: workspace.sliceBoundaries.filter((boundary) => !sliceIds.has(boundary.sliceId)),
    entitySlices: workspace.entitySlices.filter((link) => !sliceIds.has(link.sliceId)),
  });

  const applyDocumentTransaction = (input: ApplyDocumentTransactionInput): ApplyDocumentTransactionResult => {
    const current = snapshots.get(input.documentId);
    if (!current) throw new Error(`Unknown document: ${input.documentId}`);
    if (current.currentVersion !== input.baseVersion) {
      throw new Error(`Version mismatch. Expected ${current.currentVersion}, received ${input.baseVersion}.`);
    }

    const next = buildDevSnapshot(current.id, input.title || current.title, input.contentJson, current.currentVersion + input.steps.length);
    snapshots.set(next.id, next);

    const nextDoc = basicSchema.nodeFromJSON(next.contentJson);
    const mapping = createMappingFromSteps(input.steps);
    const sliceBoundaries = workspace.sliceBoundaries.map((boundary): SliceBoundaryRecord => {
      if (boundary.documentId !== next.id) return boundary;
      const resolution = mapBoundaryForward(boundary.anchor, boundary.resolution.status, mapping, nextDoc, next.currentVersion);
      return { ...boundary, anchor: resolution.anchor, resolution, updatedAt: nowIso() };
    });
    const summary = {
      ...workspace.documents.find((document) => document.id === next.id)!,
      title: next.title,
      wordCount: next.plainText.trim().split(/\s+/).filter(Boolean).length,
      characterCount: next.plainText.length,
      paragraphCount: next.plainText.split(/\n{2,}/).filter(Boolean).length,
      updatedAt: next.updatedAt,
    };
    commit({
      ...workspace,
      documents: workspace.documents.map((document) => (document.id === next.id ? summary : document)),
      sliceBoundaries,
    });
    return {
      snapshot: next,
      summary,
      sliceBoundaries: sliceBoundaries.filter((boundary) => boundary.documentId === next.id),
      historySummary: { currentVersion: next.currentVersion, stepCount: input.steps.length, checkpointCount: 0, eventCount: 0 },
    };
  };

  const echo = async () => workspace;

  const bridge: HarnessBridge = {
    async getStatus() { return STATUS; },
    async loadWorkspace() { return workspace; },
    createProject: echo,
    updateProject: echo,
    openProject: echo,
    createFolder: echo,
    updateFolder: echo,
    moveFolder: echo,
    deleteFolder: echo,
    createDocument: echo,
    updateDocumentMeta: echo,
    deleteDocument: echo,
    reorderDocument: echo,
    moveDocument: echo,
    async openDocument(input) {
      if (input.surface !== "main" || !snapshots.has(input.documentId)) return workspace;
      return commit({
        ...workspace,
        layout: { ...workspace.layout, activeDocumentId: input.documentId, lastFocusedDocumentId: input.documentId },
      });
    },
    async updateLayout(input) {
      return commit({ ...workspace, layout: { ...workspace.layout, ...input } });
    },
    async applyDocumentTransaction(input) {
      return applyDocumentTransaction(input);
    },
    async createEntity(input) {
      const timestamp = nowIso();
      const id = newId("dev-entity");
      return commit({
        ...workspace,
        entities: [...workspace.entities, { id, projectId: input.projectId, name: input.name.trim(), createdAt: timestamp, updatedAt: timestamp }],
        matchingRules: [...workspace.matchingRules, ...rulesFrom(id, input.rules ?? [], [])],
        layout: { ...workspace.layout, selectedEntityId: id },
      });
    },
    async updateEntity(input) {
      return commit({
        ...workspace,
        entities: workspace.entities.map((entity) => (entity.id === input.entityId ? { ...entity, name: input.name.trim() } : entity)),
      });
    },
    async deleteEntity(input) {
      const orphaned = new Set(workspace.entitySlices.filter((link) => link.entityId === input.entityId).map((link) => link.sliceId));
      return commit({
        ...workspace,
        ...removeSlices(orphaned),
        entities: workspace.entities.filter((entity) => entity.id !== input.entityId),
        matchingRules: workspace.matchingRules.filter((rule) => rule.entityId !== input.entityId),
      });
    },
    async setEntityRules(input) {
      const existing = workspace.matchingRules.filter((rule) => rule.entityId === input.entityId);
      return commit({
        ...workspace,
        matchingRules: [
          ...workspace.matchingRules.filter((rule) => rule.entityId !== input.entityId),
          ...rulesFrom(input.entityId, input.rules, existing),
        ],
      });
    },
    async createSlice(input) {
      const timestamp = nowIso();
      const sliceId = newId("dev-slice");
      const boundary: SliceBoundaryRecord = {
        id: `${sliceId}-boundary`,
        sliceId,
        documentId: input.documentId,
        anchor: input.anchor,
        resolution: { status: "resolved", reason: "captured from committed slice placement", anchor: input.anchor },
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      return commit({
        ...workspace,
        slices: [...workspace.slices, {
          id: sliceId,
          projectId: input.projectId,
          documentId: input.documentId,
          boundaryId: boundary.id,
          title: input.title,
          excerpt: input.anchor.exact.slice(0, 180),
          createdAt: timestamp,
          updatedAt: timestamp,
        }],
        sliceBoundaries: [...workspace.sliceBoundaries, boundary],
        entitySlices: [...workspace.entitySlices, { entityId: input.entityId, sliceId, ordering: workspace.entitySlices.length }],
      });
    },
    async deleteSlice(input) {
      return commit({ ...workspace, ...removeSlices(new Set([input.sliceId])) });
    },
    async updateSliceBoundary(input) {
      const existingBoundary = workspace.sliceBoundaries.find((boundary) => boundary.id === input.boundaryId);
      if (!existingBoundary) {
        throw new Error(`Unknown slice boundary: ${input.boundaryId}`);
      }
      const updated: SliceBoundaryRecord = {
        ...existingBoundary,
        anchor: input.anchor,
        resolution: { status: "resolved", reason: "manually repositioned by author", anchor: input.anchor },
        updatedAt: nowIso(),
      };
      commit({
        ...workspace,
        sliceBoundaries: workspace.sliceBoundaries.map((boundary) => (boundary.id === updated.id ? updated : boundary)),
      });
      return updated;
    },
    async writeCheckpoint() { /* noop */ },
    async replayDocumentToVersion(documentId) {
      return {
        snapshot: snapshots.get(documentId) ?? workspace.activeDocument!,
        sliceBoundaries: workspace.sliceBoundaries.filter((boundary) => boundary.documentId === documentId),
      };
    },
    async readClipboardText() { return ""; },
    async readClipboardHtml() { return ""; },
    async clearClipboard() { /* noop */ },
  };

  (window as unknown as { evernear: HarnessBridge }).evernear = bridge;
  // eslint-disable-next-line no-console
  console.info("[evernear] dev browser bridge installed (no Electron preload detected).");
}
