// Edit slices: dragging a slice's start or end handle, and clicking to
// focus the slice under the pointer (or none). The handles are ProseMirror widgets whose events the
// view ignores (stopEvent), so a drag never turns into a text selection.
// While dragging, only a preview moves; the boundary is saved once, on
// release.

import type { Node as ProseMirrorNode } from "prosemirror-model";
import type { EditorView } from "prosemirror-view";

import type { SliceBoundaryRecord } from "../../shared/domain/workspace";

export type BoundaryEdge = "start" | "end";

export type BoundaryDrag = {
  sliceId: string;
  edge: BoundaryEdge;
  pos: number;
};

export type BoundaryEditingCallbacks = {
  isEditable: () => boolean;
  rangeOf: (sliceId: string) => { from: number; to: number } | null;
  sliceAt: (pos: number) => string | null;
  onPreview: (drag: BoundaryDrag | null) => void;
  onCommit: (sliceId: string, from: number, to: number) => void;
  onFocusSlice: (sliceId: string | null) => void;
};

const WORD_CHARACTER = /[\p{L}\p{N}_'’]/u;

// A start edge dropped mid-word moves back to the word's first letter; an
// end edge moves on to its last. Dropping between words keeps the spot.
export function snapToWordEdge(doc: ProseMirrorNode, pos: number, edge: BoundaryEdge): number {
  const $pos = doc.resolve(pos);
  if (!$pos.parent.isTextblock) return pos;

  let snapped = pos;
  if (edge === "start") {
    const blockStart = $pos.start();
    while (snapped > blockStart && WORD_CHARACTER.test(doc.textBetween(snapped - 1, snapped))) snapped -= 1;
  } else {
    const blockEnd = $pos.end();
    while (snapped < blockEnd && WORD_CHARACTER.test(doc.textBetween(snapped, snapped + 1))) snapped += 1;
  }
  return snapped;
}

// The boundaries to paint while a handle is being dragged.
export function applyBoundaryDrag(
  boundaries: SliceBoundaryRecord[],
  drag: BoundaryDrag | null,
): SliceBoundaryRecord[] {
  if (!drag) return boundaries;
  return boundaries.map((boundary) => {
    if (boundary.sliceId !== drag.sliceId) return boundary;
    const anchor = boundary.resolution.anchor;
    const from = drag.edge === "start" ? drag.pos : anchor.from;
    const to = drag.edge === "end" ? drag.pos : anchor.to;
    if (from >= to) return boundary;
    return { ...boundary, resolution: { ...boundary.resolution, anchor: { ...anchor, from, to } } };
  });
}

// The slice covering `pos`; when slices overlap, the shortest one, which
// is the one the author most likely means.
export function innermostSliceAt(boundaries: SliceBoundaryRecord[], pos: number): string | null {
  let best: { sliceId: string; length: number } | null = null;
  for (const boundary of boundaries) {
    const { status, anchor } = boundary.resolution;
    if (status === "invalid" || status === "ambiguous") continue;
    if (pos < anchor.from || pos > anchor.to) continue;
    const length = anchor.to - anchor.from;
    if (!best || length < best.length) best = { sliceId: boundary.sliceId, length };
  }
  return best?.sliceId ?? null;
}

export function attachBoundaryEditing(
  view: EditorView,
  callbacks: () => BoundaryEditingCallbacks,
): () => void {
  let drag: { sliceId: string; edge: BoundaryEdge; range: { from: number; to: number } } | null = null;
  let previewPos: number | null = null;

  const handleMouseMove = (event: MouseEvent) => {
    if (!drag) return;
    const hit = view.posAtCoords({ left: event.clientX, top: event.clientY });
    if (!hit) return;
    const pos = snapToWordEdge(view.state.doc, hit.pos, drag.edge);
    const valid = drag.edge === "start" ? pos < drag.range.to : pos > drag.range.from;
    if (!valid || pos === previewPos) return;
    previewPos = pos;
    callbacks().onPreview({ sliceId: drag.sliceId, edge: drag.edge, pos });
  };

  const handleMouseUp = () => {
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
    const finished = drag;
    const pos = previewPos;
    drag = null;
    previewPos = null;
    callbacks().onPreview(null);
    if (!finished || pos === null) return;

    const from = finished.edge === "start" ? pos : finished.range.from;
    const to = finished.edge === "end" ? pos : finished.range.to;
    if (from !== finished.range.from || to !== finished.range.to) {
      callbacks().onCommit(finished.sliceId, from, to);
    }
  };

  const handleMouseDown = (event: MouseEvent) => {
    if (!callbacks().isEditable() || !(event.target instanceof HTMLElement)) return;

    const handle = event.target.closest<HTMLElement>(".pm-slice-handle");
    if (handle) {
      const sliceId = handle.dataset.sliceId;
      const range = sliceId ? callbacks().rangeOf(sliceId) : null;
      if (!sliceId || !range) return;
      event.preventDefault();
      drag = { sliceId, edge: handle.dataset.handle === "end" ? "end" : "start", range };
      previewPos = null;
      callbacks().onFocusSlice(sliceId);
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return;
    }

    // By position, not DOM: a click between two lines of a slice lands on
    // the paragraph, outside any decorated span.
    const hit = view.posAtCoords({ left: event.clientX, top: event.clientY });
    callbacks().onFocusSlice(hit ? callbacks().sliceAt(hit.pos) : null);
  };

  view.dom.addEventListener("mousedown", handleMouseDown);
  return () => {
    view.dom.removeEventListener("mousedown", handleMouseDown);
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
  };
}
