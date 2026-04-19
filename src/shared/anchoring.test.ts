import { describe, expect, it } from "vitest";
import { schema as basicSchema } from "prosemirror-schema-basic";
import { Node as ProseMirrorNode } from "prosemirror-model";
import { Transform } from "prosemirror-transform";

import type { JsonObject } from "./domain/document";

import {
  buildAnchorFromRange,
  buildPlainTextIndex,
  createMappingFromSteps,
  FUZZY_MATCH_AMBIGUITY_THRESHOLD,
  mapBoundaryForward,
  offsetToPosition,
  resolveAnchorWithFallback,
  resolveBlockPath,
  serializeNodePlainText,
} from "./anchoring";

// Anchors are the load-bearing mechanism that lets slice boundaries
// survive edits. These tests exercise the three states a boundary can
// land in after a document changes:
//   - resolved  (exact text still in the mapped range)
//   - repaired  (range moved, but context is unique enough to relocate it)
//   - ambiguous / invalid (context isn't enough; boundary goes unhappy)

function docOf(paragraphs: string[]): ProseMirrorNode {
  return basicSchema.nodeFromJSON({
    type: "doc",
    content: paragraphs.map((text) => ({
      type: "paragraph",
      content: text.length > 0 ? [{ type: "text", text }] : [],
    })),
  });
}

// Build an anchor around a substring of a single-paragraph doc, trusting
// the production path (plain-text index → PM positions → buildAnchor).
// If the substring isn't unique or isn't present, the helper throws.
function anchorFor(doc: ProseMirrorNode, exact: string): ReturnType<typeof buildAnchorFromRange> {
  const plainText = serializeNodePlainText(doc);
  const occurrences = [...plainText.matchAll(new RegExp(escapeRegex(exact), "g"))];
  if (occurrences.length !== 1) {
    throw new Error(`anchorFor helper expects exactly one occurrence of "${exact}"; got ${occurrences.length}`);
  }
  const plainOffset = occurrences[0]!.index!;
  const index = buildPlainTextIndex(doc);
  const from = offsetToPosition(index, plainOffset);
  const to = offsetToPosition(index, plainOffset + exact.length - 1, true);
  if (from === null || to === null) {
    throw new Error(`anchorFor could not resolve PM positions for "${exact}"`);
  }
  return buildAnchorFromRange(doc, from, to, "doc-1", 1);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

describe("buildPlainTextIndex", () => {
  it("reconstructs the plain-text projection paragraph-by-paragraph", () => {
    const doc = docOf(["Alpha beta", "Gamma delta"]);
    const index = buildPlainTextIndex(doc);
    expect(index.text).toBe("Alpha beta\n\nGamma delta");
    expect(index.charStarts.length).toBe(index.text.length);
    expect(index.charEnds.length).toBe(index.text.length);
  });

  it("textBetween(charStarts[i], charEnds[i]) round-trips to the visible character at plain offset i", () => {
    const doc = docOf(["She walked toward the harbor."]);
    const index = buildPlainTextIndex(doc);
    for (let i = 0; i < index.text.length; i += 1) {
      const expected = index.text[i]!;
      if (expected === "\n") {
        continue; // paragraph separators are synthetic
      }
      const slice = doc.textBetween(index.charStarts[i]!, index.charEnds[i]!, "\n\n");
      expect(slice).toBe(expected);
    }
  });
});

describe("buildAnchorFromRange via anchorFor helper", () => {
  it("captures exact + prefix + suffix context around a single-paragraph selection", () => {
    const doc = docOf(["She walked toward the harbor as the lights came on."]);
    const anchor = anchorFor(doc, "harbor");
    expect(anchor.exact).toBe("harbor");
    expect(anchor.prefix.endsWith("the ")).toBe(true);
    expect(anchor.suffix.startsWith(" as")).toBe(true);
    expect(anchor.versionSeen).toBe(1);
  });

  it("resolveBlockPath yields indices that track paragraph depth", () => {
    const doc = docOf(["One", "Two"]);
    const path = resolveBlockPath(doc, doc.content.size - 1);
    expect(path.length).toBeGreaterThan(0);
    expect(path[0]).toBe(1); // second paragraph
  });
});

describe("mapBoundaryForward", () => {
  it("returns `resolved` when the tracked range survives edits untouched", () => {
    const before = docOf(["She walked toward the harbor."]);
    const anchor = anchorFor(before, "harbor");

    // Insert "quickly " between "walked" and "toward" — the tracked range
    // lives later in the paragraph and shifts forward, but its content
    // is unchanged.
    const { doc: after, steps } = edit(before, (tr) => {
      const plain = serializeNodePlainText(before);
      const insertionPlainOffset = plain.indexOf("toward");
      const insertionPos = plainOffsetToPos(before, insertionPlainOffset);
      tr.insert(insertionPos, basicSchema.text("quickly "));
    });

    const mapping = createMappingFromSteps(steps);
    const result = mapBoundaryForward(anchor, mapping, after, 2);

    expect(result.status).toBe("resolved");
    expect(result.anchor.exact).toBe("harbor");
    expect(result.anchor.versionSeen).toBe(2);
  });

  it("marks the boundary absorbed when an edit happens INSIDE the anchored range", () => {
    const before = docOf(["She walked toward the harbor quickly."]);
    const anchor = anchorFor(before, "toward the harbor");

    // Insert "wide " between "the" and "harbor" — anchored range absorbs the edit.
    const { doc: after, steps } = edit(before, (tr) => {
      const plain = serializeNodePlainText(before);
      const insertionPlainOffset = plain.indexOf("harbor");
      const insertionPos = plainOffsetToPos(before, insertionPlainOffset);
      tr.insert(insertionPos, basicSchema.text("wide "));
    });

    const mapping = createMappingFromSteps(steps);
    const result = mapBoundaryForward(anchor, mapping, after, 2);

    expect(result.status).toBe("resolved");
    expect(result.reason.includes("absorbed")).toBe(true);
  });

  it("falls through to fallback when the anchored range collapses and the exact text is gone", () => {
    const before = docOf(["A wolf pack and a lone bear crossed the ridge."]);
    const anchor = anchorFor(before, "lone bear");

    // Delete " and a lone bear" from the plain text by replacing the range.
    const { doc: after, steps } = edit(before, (tr) => {
      const plain = serializeNodePlainText(before);
      const deleteFromPlain = plain.indexOf(" and a lone bear");
      const from = plainOffsetToPos(before, deleteFromPlain);
      const to = plainOffsetToPos(before, deleteFromPlain + " and a lone bear".length);
      tr.delete(from, to);
    });

    const mapping = createMappingFromSteps(steps);
    const result = mapBoundaryForward(anchor, mapping, after, 2);

    expect(result.status).toBe("invalid");
    expect(result.reason).toContain("exact text no longer exists");
  });
});

describe("resolveAnchorWithFallback", () => {
  it("repairs an anchor whose position shifted but whose text is unique", () => {
    const original = docOf(["The garden at dusk was quiet."]);
    const anchor = anchorFor(original, "at dusk");

    const nextDoc = docOf([
      "A preface paragraph with different words.",
      "The garden at dusk was quiet.",
    ]);

    const result = resolveAnchorWithFallback(anchor, nextDoc, "mapping collapsed", 5);
    expect(result.status).toBe("repaired");
    expect(result.anchor.versionSeen).toBe(5);
    // textBetween the repaired PM positions should equal the exact text.
    const repairedText = nextDoc.textBetween(result.anchor.from, result.anchor.to, "\n\n");
    expect(repairedText).toBe("at dusk");
  });

  it("flags ambiguity when multiple copies of the exact text exist with weak context", () => {
    // Two identical lines; no surrounding text to bias one over the other.
    const original = docOf(["two"]);
    const baseAnchor = anchorFor(original, "two");
    const weakAnchor = { ...baseAnchor, prefix: "", suffix: "", approxPlainTextOffset: undefined };

    const nextDoc = docOf(["two", "two"]);
    const result = resolveAnchorWithFallback(weakAnchor, nextDoc, "mapping collapsed", 2);
    expect(result.status).toBe("ambiguous");
  });

  it("returns `invalid` when the exact text is gone entirely", () => {
    const original = docOf(["Find this exact phrase here."]);
    const anchor = anchorFor(original, "exact phrase");
    const nextDoc = docOf(["Completely different prose about nothing."]);

    const result = resolveAnchorWithFallback(anchor, nextDoc, "mapping collapsed", 2);
    expect(result.status).toBe("invalid");
  });
});

describe("FUZZY_MATCH_AMBIGUITY_THRESHOLD", () => {
  // The threshold is load-bearing for the "fail closed when uncertain"
  // contract. Lock its value so a future tweak forces an explicit
  // re-justification with the test cases below.
  it("is the documented value the resolver compares score gaps against", () => {
    expect(FUZZY_MATCH_AMBIGUITY_THRESHOLD).toBe(0.25);
  });

  it("returns `repaired` when a clear single-candidate match wins by a wide margin", () => {
    // "garden at dusk" appears once; the resolver should pick it without
    // any ambiguity score competition.
    const original = docOf(["The garden at dusk was quiet."]);
    const anchor = anchorFor(original, "garden at dusk");
    const nextDoc = docOf(["Some preface.", "The garden at dusk was quiet."]);
    const result = resolveAnchorWithFallback(anchor, nextDoc, "mapping collapsed", 2);
    expect(result.status).toBe("repaired");
  });

  it("returns `repaired` when multiple candidates exist but one is the unambiguous winner via prefix/suffix", () => {
    // "the cat" appears twice; only one occurrence has the matching
    // surrounding context, so the prefix/suffix score gap exceeds the
    // ambiguity threshold and the resolver picks the right one.
    const original = docOf(["the gray sky and the cat sat on the windowsill"]);
    const anchor = anchorFor(original, "the cat");
    const nextDoc = docOf([
      "the cat was elsewhere first",
      "the gray sky and the cat sat on the windowsill",
    ]);
    const result = resolveAnchorWithFallback(anchor, nextDoc, "mapping collapsed", 2);
    expect(result.status).toBe("repaired");
    // Repaired range must be the second occurrence (the one with matching context).
    const repairedText = nextDoc.textBetween(result.anchor.from, result.anchor.to, "\n\n");
    expect(repairedText).toBe("the cat");
    expect(result.anchor.prefix.endsWith("the gray sky and ")).toBe(true);
  });

  it("returns `ambiguous` when two candidates score within the threshold of each other", () => {
    // Identical lines, no prefix/suffix to disambiguate — both candidates
    // score 0 and the gap (0) is below the 0.25 threshold.
    const original = docOf(["echo"]);
    const baseAnchor = anchorFor(original, "echo");
    const weakAnchor = { ...baseAnchor, prefix: "", suffix: "", approxPlainTextOffset: undefined };
    const nextDoc = docOf(["echo", "echo", "echo"]);
    const result = resolveAnchorWithFallback(weakAnchor, nextDoc, "mapping collapsed", 2);
    expect(result.status).toBe("ambiguous");
  });

  it("returns `invalid` when no candidates exist at all", () => {
    const original = docOf(["unique phrase"]);
    const anchor = anchorFor(original, "unique phrase");
    const nextDoc = docOf(["something else entirely"]);
    const result = resolveAnchorWithFallback(anchor, nextDoc, "mapping collapsed", 2);
    expect(result.status).toBe("invalid");
  });
});

// ──────────────────────────────────────────────────────────────────────
// Edit helpers — wrap a ProseMirror `Transform` so tests stay readable.
// The Transform captures the steps produced by each mutation, which is
// the same format createMappingFromSteps consumes.
// ──────────────────────────────────────────────────────────────────────

function edit(
  before: ProseMirrorNode,
  mutate: (tr: Transform) => void,
): { doc: ProseMirrorNode; steps: JsonObject[] } {
  const tr = new Transform(before);
  mutate(tr);
  return {
    doc: tr.doc,
    steps: tr.steps.map((step) => step.toJSON() as JsonObject),
  };
}

// Map a plain-text offset (into serializeNodePlainText(doc)) to the
// equivalent ProseMirror position. Uses the production index so the
// test drives the same math as boundary repair.
function plainOffsetToPos(doc: ProseMirrorNode, plainOffset: number): number {
  const index = buildPlainTextIndex(doc);
  const pos = offsetToPosition(index, plainOffset);
  if (pos === null) {
    throw new Error(`plainOffsetToPos: offset ${plainOffset} out of range`);
  }
  return pos;
}
