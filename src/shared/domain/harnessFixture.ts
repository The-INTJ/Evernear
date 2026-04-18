import {
  HARNESS_CONTENT_FORMAT,
  HARNESS_CONTENT_SCHEMA_VERSION,
  type JsonObject,
  type StoredDocumentSnapshot,
} from "./document";
import {
  DEFAULT_STORY_DOCUMENT_ID,
  DEFAULT_STORY_DOCUMENT_TITLE,
} from "./workspace";

export function createEmptyHarnessSnapshot(
  documentId = DEFAULT_STORY_DOCUMENT_ID,
  title = DEFAULT_STORY_DOCUMENT_TITLE,
): StoredDocumentSnapshot {
  return {
    id: documentId,
    title,
    contentFormat: HARNESS_CONTENT_FORMAT,
    contentSchemaVersion: HARNESS_CONTENT_SCHEMA_VERSION,
    contentJson: buildEmptyDocumentJson(),
    plainText: "",
    currentVersion: 0,
    updatedAt: new Date().toISOString(),
  };
}

export function buildEmptyDocumentJson(): JsonObject {
  return {
    type: "doc",
    content: [{ type: "paragraph" }],
  };
}
