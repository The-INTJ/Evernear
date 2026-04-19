// buildTextAnchorFromSelection is the front door to the anchor substrate:
// every Everlink commit and slice placement passes through it. The shape
// of the anchor it produces (exact / prefix / suffix / blockPath /
// approxPlainTextOffset / versionSeen) is what later resolves the
// boundary across edits.
//
// resolveAnchorWithFallback is tested on its own in shared/anchoring.test
// for the post-edit cases. Here we focus on the build step itself and on
// the round-trip property: an anchor built from selection X, resolved
// against the same document, must point back at X.

import { schema as basicSchema } from "prosemirror-schema-basic";
import { Node as ProseMirrorNode } from "prosemirror-model";
import { describe, expect, it } from "vitest";

import {
  HARNESS_CONTENT_FORMAT,
  HARNESS_CONTENT_SCHEMA_VERSION,
  type StoredDocumentSnapshot,
} from "../../shared/domain/document";
import {
  buildPlainTextIndex,
  offsetToPosition,
  resolveAnchorWithFallback,
  serializeNodePlainText,
} from "../../shared/anchoring";
import { buildTextAnchorFromSelection } from "./workbenchUtils";

function docOf(paragraphs: string[]): ProseMirrorNode {
  return basicSchema.nodeFromJSON({
    type: "doc",
    content: paragraphs.map((text) => ({
      type: "paragraph",
      content: text.length > 0 ? [{ type: "text", text }] : [],
    })),
  });
}

function snapshotOf(doc: ProseMirrorNode): StoredDocumentSnapshot {
  return {
    id: "doc-test",
    title: "Test",
    contentFormat: HARNESS_CONTENT_FORMAT,
    contentSchemaVersion: HARNESS_CONTENT_SCHEMA_VERSION,
    contentJson: doc.toJSON() as StoredDocumentSnapshot["contentJson"],
    plainText: serializeNodePlainText(doc),
    currentVersion: 1,
    updatedAt: "2026-04-19T00:00:00.000Z",
  };
}

// Find the PM positions for the first occurrence of `text` in the doc's
// plain text. Returns { from, to } as PM positions (not plain-text offsets).
function pmRangeFor(doc: ProseMirrorNode, text: string): { from: number; to: number } {
  const plain = serializeNodePlainText(doc);
  const offset = plain.indexOf(text);
  if (offset === -1) {
    throw new Error(`pmRangeFor could not find "${text}" in ${JSON.stringify(plain)}`);
  }
  const index = buildPlainTextIndex(doc);
  const from = offsetToPosition(index, offset);
  const to = offsetToPosition(index, offset + text.length - 1, true);
  if (from === null || to === null) {
    throw new Error(`pmRangeFor could not map "${text}" to PM positions`);
  }
  return { from, to };
}

describe("buildTextAnchorFromSelection", () => {
  it("returns null for an empty selection (cursor with no range)", () => {
    const doc = docOf(["Hello world"]);
    const snapshot = snapshotOf(doc);
    const anchor = buildTextAnchorFromSelection(snapshot, {
      from: 3,
      to: 3,
      empty: true,
      text: "",
    });
    expect(anchor).toBeNull();
  });

  it("returns null when from >= to even if the selection claims to be non-empty", () => {
    const doc = docOf(["Hello world"]);
    const snapshot = snapshotOf(doc);
    expect(buildTextAnchorFromSelection(snapshot, {
      from: 5,
      to: 5,
      empty: false,
      text: "",
    })).toBeNull();
    expect(buildTextAnchorFromSelection(snapshot, {
      from: 6,
      to: 5,
      empty: false,
      text: "",
    })).toBeNull();
  });

  it("captures exact, prefix, suffix, and block path for a single-block selection", () => {
    const doc = docOf(["Once upon a time, in a far away land."]);
    const snapshot = snapshotOf(doc);
    const range = pmRangeFor(doc, "in a far away");

    const anchor = buildTextAnchorFromSelection(snapshot, {
      from: range.from,
      to: range.to,
      empty: false,
      text: "in a far away",
    });

    expect(anchor).not.toBeNull();
    expect(anchor!.exact).toBe("in a far away");
    expect(anchor!.prefix.endsWith("time, ")).toBe(true);
    expect(anchor!.suffix.startsWith(" land.")).toBe(true);
    // First paragraph (depth 0 index 0), first text node child (depth 1 index 0).
    expect(anchor!.blockPath).toEqual([0, 0]);
    expect(anchor!.documentId).toBe("doc-test");
    expect(anchor!.versionSeen).toBe(snapshot.currentVersion);
    expect(anchor!.approxPlainTextOffset).toBe(snapshot.plainText.indexOf("in a far away"));
  });

  it("round-trips: an anchor built from a selection resolves back to the same range", () => {
    const doc = docOf(["The quick brown fox jumps over the lazy dog."]);
    const snapshot = snapshotOf(doc);
    const range = pmRangeFor(doc, "brown fox");

    const anchor = buildTextAnchorFromSelection(snapshot, {
      from: range.from,
      to: range.to,
      empty: false,
      text: "brown fox",
    })!;

    const resolved = resolveAnchorWithFallback(anchor, doc, "round-trip", snapshot.currentVersion);
    // Same-doc resolve runs through the fallback path; we accept either
    // status as long as the range matches the original positions.
    expect(["resolved", "repaired"]).toContain(resolved.status);
    expect(resolved.anchor.from).toBe(range.from);
    expect(resolved.anchor.to).toBe(range.to);
    expect(resolved.anchor.exact).toBe("brown fox");
  });

  it("captures exact spanning a block boundary using the \\n\\n join", () => {
    const doc = docOf(["First paragraph end.", "Start of second."]);
    const snapshot = snapshotOf(doc);

    // Find positions: end of first paragraph and middle of second.
    const firstPara = doc.firstChild!;
    const fromPos = firstPara.nodeSize - 5; // a few chars before close of first para
    // 1 (paragraph open) + textContent.length - 5
    const toPos = firstPara.nodeSize + 1 + "Start".length; // inside second paragraph

    const text = doc.textBetween(fromPos, toPos, "\n\n");

    const anchor = buildTextAnchorFromSelection(snapshot, {
      from: fromPos,
      to: toPos,
      empty: false,
      text,
    });

    expect(anchor).not.toBeNull();
    expect(anchor!.exact).toBe(text);
    expect(anchor!.exact).toContain("\n\n");
  });

  it("uses an empty prefix when the selection starts at the document head", () => {
    const doc = docOf(["Heading text only."]);
    const snapshot = snapshotOf(doc);
    const range = pmRangeFor(doc, "Heading");

    const anchor = buildTextAnchorFromSelection(snapshot, {
      from: range.from,
      to: range.to,
      empty: false,
      text: "Heading",
    })!;

    // The selection starts at PM position 1 (just inside the first
    // paragraph), so prefix has nothing to grab.
    expect(anchor.prefix).toBe("");
    expect(anchor.suffix.startsWith(" text only.")).toBe(true);
  });

  it("uses an empty suffix when the selection ends at the document tail", () => {
    const doc = docOf(["Trailing tail."]);
    const snapshot = snapshotOf(doc);
    const range = pmRangeFor(doc, "tail.");

    const anchor = buildTextAnchorFromSelection(snapshot, {
      from: range.from,
      to: range.to,
      empty: false,
      text: "tail.",
    })!;

    expect(anchor.suffix).toBe("");
    expect(anchor.prefix.endsWith("Trailing ")).toBe(true);
  });

  it("disambiguates a repeated 'exact' through prefix/suffix during resolve", () => {
    // Same word "fox" appears twice; the anchor must pick the one whose
    // surrounding context matches.
    const doc = docOf(["A red fox sits.", "A blue fox runs."]);
    const snapshot = snapshotOf(doc);

    // Build the anchor against the SECOND occurrence specifically.
    const plain = serializeNodePlainText(doc);
    const secondOffset = plain.indexOf("fox", plain.indexOf("fox") + 1);
    expect(secondOffset).toBeGreaterThan(0);

    const index = buildPlainTextIndex(doc);
    const from = offsetToPosition(index, secondOffset)!;
    const to = offsetToPosition(index, secondOffset + 2, true)!;

    const anchor = buildTextAnchorFromSelection(snapshot, {
      from,
      to,
      empty: false,
      text: "fox",
    })!;

    // The prefix/suffix should contain context unique to the second
    // occurrence ("blue " before, " runs." after).
    expect(anchor.prefix).toContain("blue");

    const resolved = resolveAnchorWithFallback(anchor, doc, "disambiguation", snapshot.currentVersion);
    expect(["resolved", "repaired"]).toContain(resolved.status);
    expect(resolved.anchor.from).toBe(from);
    expect(resolved.anchor.to).toBe(to);
  });
});
