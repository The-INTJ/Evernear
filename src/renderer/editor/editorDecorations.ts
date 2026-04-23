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

export function recomputeDecorations(
  view: EditorView,
  surface: HTMLDivElement | null,
  decorationRef: DecorationRef,
  matchingRules: EditorMatchingRule[],
  sliceBoundaries: SliceBoundaryRecord[],
  pendingRange: { from: number; to: number } | null,
  decorationsEnabled: boolean,
  boundariesEditable: boolean,
  onMatchingBenchmark: ((benchmark: MatchingBenchmark) => void) | undefined,
): void {
  if (!decorationsEnabled || !surface) {
    decorationRef.current = DecorationSet.empty;
    refreshDecorations(view, decorationRef);
    return;
  }

  const startedAt = performance.now();
  const visibleBlocks = collectVisibleBlocks(view, surface);
  const matchHits = collectMatchesForVisibleBlocks(matchingRules, visibleBlocks);
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

  for (const boundary of sliceBoundaries) {
    const { from, to } = boundary.resolution.anchor;
    if (from >= to) continue;

    const inlineClass = boundariesEditable
      ? `pm-slice-boundary pm-slice-boundary--${boundary.resolution.status} pm-slice-boundary--editing`
      : `pm-slice-boundary pm-slice-boundary--${boundary.resolution.status}`;

    decorations.push(Decoration.inline(from, to, {
      class: inlineClass,
      "data-slice-id": boundary.sliceId,
    }, { inclusiveEnd: true }));

    if (boundariesEditable) {
      decorations.push(Decoration.widget(from, buildBoundaryHandle(boundary.sliceId, "start"), { side: -1 }));
      decorations.push(Decoration.widget(to, buildBoundaryHandle(boundary.sliceId, "end"), { side: 1 }));
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
  const visibleCharacterCount = visibleBlocks.reduce((total, block) => total + block.text.length, 0);

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

function buildBoundaryHandle(sliceId: string, position: "start" | "end"): () => HTMLElement {
  return () => {
    const element = document.createElement("span");
    element.className = `pm-slice-handle pm-slice-handle--${position}`;
    element.dataset.sliceId = sliceId;
    element.dataset.handle = position;
    return element;
  };
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
      text: block.textBetween(0, block.content.size, "\n\n"),
    });
  });

  return visibleBlocks;
}
