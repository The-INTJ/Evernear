export const HARNESS_DOCUMENT_ID = "phase-1-manuscript";
export const HARNESS_DOCUMENT_TITLE = "Phase 1 Round-Trip Manuscript";
export const HARNESS_CONTENT_FORMAT = "prosemirror-basic";
export const HARNESS_CONTENT_SCHEMA_VERSION = 1;

export type JsonPrimitive = boolean | number | string | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = {
  [key: string]: JsonValue;
};

export type StoredDocumentSnapshot = {
  id: string;
  title: string;
  contentFormat: string;
  contentSchemaVersion: number;
  contentJson: JsonObject;
  plainText: string;
  currentVersion: number;
  updatedAt: string;
};

export type SaveHarnessDocumentInput = {
  id: string;
  title: string;
  contentJson: JsonObject;
  plainText: string;
};

export type SeedFixtureResult = {
  snapshot: StoredDocumentSnapshot;
  wordCount: number;
};

export type PersistedDocumentSelection = {
  from: number;
  to: number;
};

export type DocumentMetrics = {
  wordCount: number;
  characterCount: number;
  paragraphCount: number;
};

export function collectDocumentMetrics(plainText: string): DocumentMetrics {
  const trimmed = plainText.trim();
  const words = trimmed.length === 0 ? [] : trimmed.split(/\s+/);
  const paragraphs = plainText
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return {
    wordCount: words.length,
    characterCount: plainText.length,
    paragraphCount: paragraphs.length,
  };
}
