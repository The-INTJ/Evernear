import {
  HARNESS_CONTENT_FORMAT,
  HARNESS_CONTENT_SCHEMA_VERSION,
  HARNESS_DOCUMENT_ID,
  HARNESS_DOCUMENT_TITLE,
  type JsonObject,
  type StoredDocumentSnapshot,
} from "./document";

type ProseMirrorNodeJson = {
  type: string;
  attrs?: Record<string, number | string | boolean>;
  text?: string;
  content?: ProseMirrorNodeJson[];
};

function buildEmptyDocumentJson(): JsonObject {
  return {
    type: "doc",
    content: [{ type: "paragraph" }],
  };
}

function buildParagraphNode(text: string): ProseMirrorNodeJson {
  return {
    type: "paragraph",
    content: [{ type: "text", text }],
  };
}

function buildHeading(level: number, text: string): ProseMirrorNodeJson {
  return {
    type: "heading",
    attrs: { level },
    content: [{ type: "text", text }],
  };
}

export function createEmptyHarnessSnapshot(): StoredDocumentSnapshot {
  return {
    id: HARNESS_DOCUMENT_ID,
    title: HARNESS_DOCUMENT_TITLE,
    contentFormat: HARNESS_CONTENT_FORMAT,
    contentSchemaVersion: HARNESS_CONTENT_SCHEMA_VERSION,
    contentJson: buildEmptyDocumentJson(),
    plainText: "",
    currentVersion: 0,
    updatedAt: new Date().toISOString(),
  };
}

export function createSmallWorkbenchFixture(): Pick<StoredDocumentSnapshot, "contentJson" | "plainText"> {
  const blocks: ProseMirrorNodeJson[] = [
    buildHeading(1, "Part 1"),
    buildHeading(1, "Chapter 1"),
    buildParagraphNode("Tylen walked White Harbor twice while Aurelia Vale copied the ferry ledger."),
    buildParagraphNode("If you would go slower, Tylen, it might help, his mother said as the tide bells faded."),
    buildParagraphNode("Aurelia's notes mentioned White Harbor, the Glass Archive, and Larkspur Gate."),
  ];

  return {
    contentJson: {
      type: "doc",
      content: blocks,
    },
    plainText: [
      "Part 1",
      "Chapter 1",
      "Tylen walked White Harbor twice while Aurelia Vale copied the ferry ledger.",
      "If you would go slower, Tylen, it might help, his mother said as the tide bells faded.",
      "Aurelia's notes mentioned White Harbor, the Glass Archive, and Larkspur Gate.",
    ].join("\n\n"),
  };
}
