import type {
  SaveHarnessDocumentInput,
  SeedFixtureResult,
  StoredDocumentSnapshot,
} from "../domain/document";

export const HARNESS_CHANNELS = {
  getStatus: "harness:get-status",
  loadDocument: "harness:load-document",
  saveDocument: "harness:save-document",
  seedFixture: "harness:seed-fixture",
  readClipboardText: "harness:read-clipboard-text",
  readClipboardHtml: "harness:read-clipboard-html",
  clearClipboard: "harness:clear-clipboard",
} as const;

export type HarnessStatus = {
  dbPath: string;
  documentId: string;
  contentFormat: string;
  contentSchemaVersion: number;
};

export interface HarnessBridge {
  getStatus(): Promise<HarnessStatus>;
  loadDocument(): Promise<StoredDocumentSnapshot | null>;
  saveDocument(input: SaveHarnessDocumentInput): Promise<StoredDocumentSnapshot>;
  seedFixture(): Promise<SeedFixtureResult>;
  readClipboardText(): Promise<string>;
  readClipboardHtml(): Promise<string>;
  clearClipboard(): Promise<void>;
}
