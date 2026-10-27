import { describe, expect, it } from "vitest";
import { schema as basicSchema } from "prosemirror-schema-basic";

import type { SliceBoundaryRecord } from "../../shared/domain/workspace";
import { buildAnchorFromRange } from "../../shared/anchoring";
import { applyBoundaryDrag, innermostSliceAt, snapToWordEdge } from "./boundaryDrag";

const doc = basicSchema.nodeFromJSON({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "The Spire's upper windows glow." }] }],
});

// Paragraph content starts at position 1, so a character's position is
// its index in the text plus one.
function posOf(text: string): number {
  return "The Spire's upper windows glow.".indexOf(text) + 1;
}

describe("snapToWordEdge", () => {
  it("moves a start edge dropped mid-word back to the word's first letter", () => {
    expect(snapToWordEdge(doc, posOf("per windows"), "start")).toBe(posOf("upper"));
  });

  it("moves an end edge dropped mid-word on to the word's last letter", () => {
    expect(snapToWordEdge(doc, posOf("dows"), "end")).toBe(posOf(" glow"));
  });

  it("keeps an apostrophe inside the word it belongs to", () => {
    expect(snapToWordEdge(doc, posOf("ire's"), "end")).toBe(posOf(" upper"));
  });

  it("leaves an edge dropped between words where it is", () => {
    expect(snapToWordEdge(doc, posOf(" upper"), "end")).toBe(posOf(" upper"));
    expect(snapToWordEdge(doc, posOf("upper"), "start")).toBe(posOf("upper"));
  });
});

describe("applyBoundaryDrag", () => {
  const anchor = buildAnchorFromRange(doc, posOf("upper"), posOf(" glow"), "doc-1", 1);
  const boundary: SliceBoundaryRecord = {
    id: "boundary-1",
    sliceId: "slice-1",
    documentId: "doc-1",
    anchor,
    resolution: { status: "resolved", reason: "test", anchor },
    createdAt: "2026-10-27T00:00:00.000Z",
    updatedAt: "2026-10-27T00:00:00.000Z",
  };

  it("moves only the dragged edge of the dragged slice", () => {
    const [moved] = applyBoundaryDrag([boundary], { sliceId: "slice-1", edge: "start", pos: posOf("The") });
    expect(moved!.resolution.anchor.from).toBe(posOf("The"));
    expect(moved!.resolution.anchor.to).toBe(anchor.to);
  });

  it("ignores a drag that would collapse the slice", () => {
    const [unchanged] = applyBoundaryDrag([boundary], { sliceId: "slice-1", edge: "end", pos: anchor.from });
    expect(unchanged).toBe(boundary);
  });

  it("returns the same list when nothing is being dragged", () => {
    const boundaries = [boundary];
    expect(applyBoundaryDrag(boundaries, null)).toBe(boundaries);
  });
});

describe("innermostSliceAt", () => {
  function boundaryFor(sliceId: string, from: number, to: number, status: "resolved" | "invalid" = "resolved"): SliceBoundaryRecord {
    const anchor = buildAnchorFromRange(doc, from, to, "doc-1", 1);
    return {
      id: `${sliceId}-boundary`,
      sliceId,
      documentId: "doc-1",
      anchor,
      resolution: { status, reason: "test", anchor },
      createdAt: "2026-10-27T00:00:00.000Z",
      updatedAt: "2026-10-27T00:00:00.000Z",
    };
  }

  const outer = boundaryFor("outer", posOf("The"), posOf("."));
  const inner = boundaryFor("inner", posOf("upper"), posOf(" glow"));

  it("picks the shortest slice covering the position", () => {
    expect(innermostSliceAt([outer, inner], posOf("windows"))).toBe("inner");
    expect(innermostSliceAt([outer, inner], posOf("Spire"))).toBe("outer");
  });

  it("finds nothing outside every slice, and skips lost slices", () => {
    expect(innermostSliceAt([inner], posOf("Spire"))).toBeNull();
    expect(innermostSliceAt([boundaryFor("lost", posOf("The"), posOf("."), "invalid")], posOf("Spire"))).toBeNull();
  });
});
