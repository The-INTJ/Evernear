// Seed data for the dev browser bridge: a story draft and a lore page, two
// entities, and one slice in each document.

import { schema as basicSchema } from "prosemirror-schema-basic";

import type { JsonObject, StoredDocumentSnapshot } from "../../shared/domain/document";
import type {
  SliceBoundaryRecord,
  WorkspaceState,
} from "../../shared/domain/workspace";
import { buildAnchorFromRange, buildPlainTextIndex, offsetToPosition } from "../../shared/anchoring";

const PROJECT_ID = "dev-project";
const FOLDER_ID = "dev-folder";
const STORY_ID = "dev-doc-story";
const PLACES_ID = "dev-doc-places";

const STORY = [
  "Kaevlin walked toward the harbor as the lights came on one by one along the pier. Above the rooftops, the Spire caught the last of the sun.",
  "She had been coming here since she was small, and tonight the smell of cold salt and kerosene reminded her that some things refused to change.",
  "Kaevlin crouched beside a coil of rope and waited. Something about the rhythm under the boards felt off, a half-beat slower than the water.",
];

const PLACES = [
  "The Spire is the last tower of the old kingdom, older than the city that grew up around it. Its upper windows are lit every night, though no one admits to climbing the stair.",
  "The Harbor District sits below it, all rope, tar and lantern light.",
];

export function nowIso(): string {
  return new Date().toISOString();
}

export function buildDevSnapshot(id: string, title: string, contentJson: JsonObject, version: number): StoredDocumentSnapshot {
  const doc = basicSchema.nodeFromJSON(contentJson);
  return {
    id,
    title,
    contentFormat: "prosemirror-basic",
    contentSchemaVersion: 1,
    contentJson,
    plainText: doc.textBetween(0, doc.content.size, "\n\n"),
    currentVersion: version,
    updatedAt: nowIso(),
  };
}

function paragraphsJson(paragraphs: string[]): JsonObject {
  return {
    type: "doc",
    content: paragraphs.map((text) => ({ type: "paragraph", content: [{ type: "text", text }] })),
  };
}

function boundaryFor(
  snapshot: StoredDocumentSnapshot,
  sliceId: string,
  text: string,
): SliceBoundaryRecord {
  const doc = basicSchema.nodeFromJSON(snapshot.contentJson);
  const index = buildPlainTextIndex(doc);
  const offset = index.text.indexOf(text);
  const from = offsetToPosition(index, offset)!;
  const to = offsetToPosition(index, offset + text.length - 1, true)!;
  const anchor = buildAnchorFromRange(doc, from, to, snapshot.id, snapshot.currentVersion);
  const timestamp = nowIso();
  return {
    id: `${sliceId}-boundary`,
    sliceId,
    documentId: snapshot.id,
    anchor,
    resolution: { status: "resolved", reason: "seeded by dev browser bridge", anchor },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function buildDevSeed(): { workspace: WorkspaceState; snapshots: Map<string, StoredDocumentSnapshot> } {
  const timestamp = nowIso();
  const story = buildDevSnapshot(STORY_ID, "The Harbor", paragraphsJson(STORY), 1);
  const places = buildDevSnapshot(PLACES_ID, "Places", paragraphsJson(PLACES), 1);
  const snapshots = new Map([[story.id, story], [places.id, places]]);

  const spireBoundary = boundaryFor(places, "dev-slice-spire", PLACES[0]!);
  const kaevlinBoundary = boundaryFor(story, "dev-slice-kaevlin", STORY[2]!);

  const workspace: WorkspaceState = {
    projects: [{ id: PROJECT_ID, name: "Dev Preview Project", createdAt: timestamp, updatedAt: timestamp }],
    folders: [{
      id: FOLDER_ID,
      projectId: PROJECT_ID,
      parentFolderId: null,
      title: "Story",
      ordering: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    }],
    documents: [story, places].map((snapshot, ordering) => ({
      id: snapshot.id,
      projectId: PROJECT_ID,
      folderId: FOLDER_ID,
      title: snapshot.title,
      ordering,
      wordCount: snapshot.plainText.trim().split(/\s+/).length,
      characterCount: snapshot.plainText.length,
      paragraphCount: snapshot.plainText.split(/\n{2,}/).length,
      createdAt: timestamp,
      updatedAt: timestamp,
    })),
    activeDocument: story,
    panelDocument: null,
    entities: [
      { id: "dev-entity-kaevlin", projectId: PROJECT_ID, name: "Kaevlin", createdAt: timestamp, updatedAt: timestamp },
      { id: "dev-entity-spire", projectId: PROJECT_ID, name: "The Spire", createdAt: timestamp, updatedAt: timestamp },
    ],
    matchingRules: [
      {
        id: "dev-rule-kaevlin",
        entityId: "dev-entity-kaevlin",
        label: "\\bKaevlin\\b",
        pattern: "\\bKaevlin\\b",
        enabled: true,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: "dev-rule-spire",
        entityId: "dev-entity-spire",
        label: "\\bThe\\s+Spire\\b",
        pattern: "\\bThe\\s+Spire\\b",
        enabled: true,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    slices: [
      {
        id: "dev-slice-spire",
        projectId: PROJECT_ID,
        documentId: PLACES_ID,
        boundaryId: spireBoundary.id,
        title: PLACES[0]!.slice(0, 42),
        excerpt: PLACES[0]!.slice(0, 180),
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: "dev-slice-kaevlin",
        projectId: PROJECT_ID,
        documentId: STORY_ID,
        boundaryId: kaevlinBoundary.id,
        title: STORY[2]!.slice(0, 42),
        excerpt: STORY[2]!.slice(0, 180),
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    sliceBoundaries: [spireBoundary, kaevlinBoundary],
    entitySlices: [
      { entityId: "dev-entity-spire", sliceId: "dev-slice-spire", ordering: 0 },
      { entityId: "dev-entity-kaevlin", sliceId: "dev-slice-kaevlin", ordering: 0 },
    ],
    layout: {
      activeProjectId: PROJECT_ID,
      activeDocumentId: STORY_ID,
      panelDocumentId: null,
      selectedEntityId: null,
      expandedFolderIds: [FOLDER_ID],
      highlightsEnabled: true,
      slicesVisible: false,
      panelOpen: false,
      panelMode: "entities",
      lastFocusedDocumentId: STORY_ID,
      recentTargetDocumentIds: [],
    },
  };

  return { workspace, snapshots };
}
