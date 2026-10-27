import { Decoration, DecorationSet, EditorView, type DecorationSource } from "prosemirror-view";

import type { MatchingBenchmark, SliceBoundaryRecord } from "../../shared/domain/workspace";
import {
  type EditorMatchingRule,
  collectMatchesForVisibleBlocks,
  type VisibleBlockRange,
} from "./editorUtils";

type DecorationRef = {
  current: DecorationSet;
};

export type DecorationInputs = {
  matchingRules: EditorMatchingRule[];
  sliceBoundaries: SliceBoundaryRecord[];
  pendingRange: { from: number; to: number } | null;
  decorationsEnabled: boolean;
  // Edit slices: handles on every slice, and the focused one drawn darker.
  boundariesEditable: boolean;
  focusedSliceId: string | null;
  onMatchingBenchmark?: (benchmark: MatchingBenchmark) => void;
};

export function recomputeDecorations(
  view: EditorView,
  surface: HTMLDivElement | null,
  decorationRef: DecorationRef,
  inputs: DecorationInputs,
): void {
  const {
    matchingRules,
    sliceBoundaries,
    pendingRange,
    decorationsEnabled,
    boundariesEditable,
    focusedSliceId,
    onMatchingBenchmark,
  } = inputs;
  if (!decorationsEnabled || !surface) {
    decorationRef.current = DecorationSet.empty;
    refreshDecorations(view, decorationRef);
    return;
  }

  const startedAt = performance.now();
  const visibleBlocks = collectVisibleBlocks(view, surface);
  const matchHits = collectMatchesForVisibleBlocks(view.state.doc, matchingRules, visibleBlocks);
  const decorations: Decoration[] = [];

  for (const hit of matchHits) {
    decorations.push(
      Decoration.inline(hit.from, hit.to, {
        class: "pm-match-highlight",
        "data-entity-id": hit.entityId,
        "data-entity-name": hit.entityName,
      }),
    );
  }

  const docSize = view.state.doc.content.size;
  for (const boundary of sliceBoundaries) {
    // Unresolved boundaries keep positions from an older version of the
    // document; painting them would point at the wrong text.
    const { status } = boundary.resolution;
    if (status === "invalid" || status === "ambiguous") continue;
    const { from, to } = boundary.resolution.anchor;
    if (from >= to || to > docSize) continue;

    // A tint over the text plus one bar in the margin per paragraph the
    // slice touches. Inline borders would repeat at every text fragment
    // (each mark change, each paragraph) and nudge the prose sideways.
    const focused = boundariesEditable && boundary.sliceId === focusedSliceId;
    decorations.push(Decoration.inline(from, to, {
      class: focused ? "pm-slice pm-slice--focused" : "pm-slice",
      "data-slice-id": boundary.sliceId,
    }, { inclusiveEnd: true }));
    view.state.doc.nodesBetween(from, to, (node, pos) => {
      if (!node.isTextblock) return true;
      decorations.push(Decoration.node(pos, pos + node.nodeSize, {
        class: focused ? "pm-slice-block pm-slice-block--focused" : "pm-slice-block",
      }));
      return false;
    });

    if (boundariesEditable) {
      decorations.push(handleWidget(from, boundary.sliceId, "start"));
      decorations.push(handleWidget(to, boundary.sliceId, "end"));
    }
  }

  if (pendingRange) {
    const from = Math.min(pendingRange.from, pendingRange.to);
    const to = Math.max(pendingRange.from, pendingRange.to);

    if (from === to) {
      decorations.push(Decoration.widget(from, buildPendingMarker("pm-pending-slice-caret"), { side: -1 }));
    } else {
      decorations.push(Decoration.inline(from, to, { class: "pm-pending-slice-range" }));
      decorations.push(Decoration.widget(from, buildPendingMarker("pm-pending-slice-rail"), { side: -1 }));
      decorations.push(Decoration.widget(to, buildPendingMarker("pm-pending-slice-rail"), { side: 1 }));
    }
  }

  decorationRef.current = DecorationSet.create(view.state.doc, decorations);
  refreshDecorations(view, decorationRef);

  const visibleFrom = visibleBlocks.length > 0 ? Math.min(...visibleBlocks.map((block) => block.from)) : 0;
  const visibleTo = visibleBlocks.length > 0 ? Math.max(...visibleBlocks.map((block) => block.to)) : 0;
  const visibleCharacterCount = visibleBlocks.reduce((total, block) => total + (block.to - block.from), 0);

  onMatchingBenchmark?.({
    visibleFrom,
    visibleTo,
    visibleCharacterCount,
    matchCount: matchHits.length,
    recomputeMs: performance.now() - startedAt,
    ruleCount: matchingRules.filter((rule) => rule.enabled).length,
    highlightingEnabled: decorationsEnabled,
    createdAt: new Date().toISOString(),
  });
}

export function decorationSource(
  decorationRef: DecorationRef,
): ((state: unknown) => DecorationSource | null) | undefined {
  return () => decorationRef.current;
}

function buildPendingMarker(className: string): () => HTMLElement {
  return () => {
    const element = document.createElement("span");
    element.className = className;
    return element;
  };
}

// stopEvent hands the handle's mouse events to boundaryDrag.ts instead of
// the view, so pressing one starts a drag rather than a text selection.
function handleWidget(pos: number, sliceId: string, position: "start" | "end"): Decoration {
  return Decoration.widget(pos, () => {
    const element = document.createElement("span");
    element.className = `pm-slice-handle pm-slice-handle--${position}`;
    element.contentEditable = "false";
    element.dataset.sliceId = sliceId;
    element.dataset.handle = position;
    element.title = position === "start" ? "Drag to move where this slice starts" : "Drag to move where this slice ends";
    return element;
  }, {
    side: position === "start" ? -1 : 1,
    key: `${sliceId}-${position}`,
    ignoreSelection: true,
    stopEvent: () => true,
  });
}

function refreshDecorations(
  view: EditorView,
  decorationRef: DecorationRef,
): void {
  view.setProps({
    decorations: decorationSource(decorationRef),
  });
  view.updateState(view.state);
}

function collectVisibleBlocks(
  view: EditorView,
  surface: HTMLDivElement,
): VisibleBlockRange[] {
  const bounds = surface.getBoundingClientRect();
  const visibleBlocks: VisibleBlockRange[] = [];

  view.state.doc.forEach((block, offset) => {
    const nodeDom = view.nodeDOM(offset) as HTMLElement | null;
    if (!nodeDom) return;

    const rect = nodeDom.getBoundingClientRect();
    if (rect.bottom < bounds.top || rect.top > bounds.bottom) return;

    visibleBlocks.push({
      from: offset + 1,
      to: offset + block.nodeSize - 1,
    });
  });

  return visibleBlocks;
}
