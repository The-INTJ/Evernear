import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";

import { baseKeymap, toggleMark } from "prosemirror-commands";
import { history, redo, undo } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import type { MarkType, Node as ProseMirrorNode, Slice } from "prosemirror-model";
import { schema as basicSchema } from "prosemirror-schema-basic";
import { AllSelection, EditorState, type Transaction } from "prosemirror-state";
import { Decoration, DecorationSet, EditorView, type DecorationSource } from "prosemirror-view";

import {
  type DocumentMetrics,
  type JsonObject,
  collectDocumentMetrics,
} from "../../shared/domain/document";
import type {
  MatchingBenchmark,
  SliceBoundaryRecord,
} from "../../shared/domain/workspace";
import {
  type EditorMatchingRule,
  type EditorSelectionInfo,
  type SerializedTransactionBundle,
  collectMatchesForVisibleBlocks,
  type VisibleBlockRange,
} from "./editorUtils";

export type HarnessEditorSnapshot = {
  contentJson: JsonObject;
  plainText: string;
  metrics: DocumentMetrics;
};

export type PendingSliceRange = {
  from: number;
  to: number;
  awaitingPlacement?: boolean;
};

export type HarnessEditorHandle = {
  getSnapshot(): HarnessEditorSnapshot;
  getSelection(): EditorSelectionInfo;
  focus(): void;
  selectAll(): void;
  toggleBold(): void;
  toggleItalic(): void;
  replaceSelection(text: string): { from: number; to: number } | null;
};

type HarnessEditorProps = {
  initialDocumentJson: JsonObject;
  decorationsEnabled: boolean;
  matchingRules?: EditorMatchingRule[];
  sliceBoundaries?: SliceBoundaryRecord[];
  // When true, boundaries paint with the `--editing` modifier and gain
  // start/end handle widgets. Foundation for drag-to-reposition; the
  // gesture itself is not implemented yet.
  boundariesEditable?: boolean;
  pendingRange?: PendingSliceRange | null;
  showLegend?: boolean;
  legendLabels?: {
    match?: string;
    boundary?: string;
    pending?: string;
  };
  onDocumentSnapshotChange(nextSnapshot: HarnessEditorSnapshot, transaction: SerializedTransactionBundle | null): void;
  onSelectionChange(selection: EditorSelectionInfo): void;
  onMatchingBenchmark?(benchmark: MatchingBenchmark): void;
  onEntityHover?(payload: { entityId: string; clientX: number; clientY: number } | null): void;
  onEntityClick?(entityId: string): void;
  onBlur?(): void;
};

export const HarnessEditor = forwardRef<HarnessEditorHandle, HarnessEditorProps>(
  function HarnessEditor(props, ref) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const surfaceRef = useRef<HTMLDivElement | null>(null);
    const viewRef = useRef<EditorView | null>(null);
    const onDocumentSnapshotChangeRef = useRef(props.onDocumentSnapshotChange);
    const onSelectionChangeRef = useRef(props.onSelectionChange);
    const onMatchingBenchmarkRef = useRef(props.onMatchingBenchmark);
    const onEntityHoverRef = useRef(props.onEntityHover);
    const onEntityClickRef = useRef(props.onEntityClick);
    const onBlurRef = useRef(props.onBlur);
    // Tracks the entity id reported by the last mousemove. We only fire
    // onEntityHover(null) when the cursor *transitions* off an entity word —
    // otherwise every mousemove over plain text would kick the App-level
    // close timer, making the floating preview unreachable.
    const lastEntityIdRef = useRef<string | null>(null);
    const currentDecorationsRef = useRef<DecorationSet>(DecorationSet.empty);
    const rulesRef = useRef(props.matchingRules ?? []);
    const boundariesRef = useRef(props.sliceBoundaries ?? []);
    const pendingRangeRef = useRef(props.pendingRange ?? null);
    const decorationsEnabledRef = useRef(props.decorationsEnabled);
    const boundariesEditableRef = useRef(props.boundariesEditable ?? false);

    onDocumentSnapshotChangeRef.current = props.onDocumentSnapshotChange;
    onSelectionChangeRef.current = props.onSelectionChange;
    onMatchingBenchmarkRef.current = props.onMatchingBenchmark;
    onEntityHoverRef.current = props.onEntityHover;
    onEntityClickRef.current = props.onEntityClick;
    onBlurRef.current = props.onBlur;
    rulesRef.current = props.matchingRules ?? [];
    boundariesRef.current = props.sliceBoundaries ?? [];
    pendingRangeRef.current = props.pendingRange ?? null;
    decorationsEnabledRef.current = props.decorationsEnabled;
    boundariesEditableRef.current = props.boundariesEditable ?? false;

    useEffect(() => {
      if (!containerRef.current || viewRef.current) {
        return;
      }

      const view = new EditorView(containerRef.current, {
        state: createEditorState(props.initialDocumentJson),
        dispatchTransaction(transaction) {
          const currentView = viewRef.current;
          if (!currentView) {
            return;
          }

          const nextState = currentView.state.apply(transaction);
          currentView.updateState(nextState);
          recomputeDecorations(
            currentView,
            surfaceRef.current,
            currentDecorationsRef,
            rulesRef.current,
            boundariesRef.current,
            pendingRangeRef.current,
            decorationsEnabledRef.current,
            boundariesEditableRef.current,
            onMatchingBenchmarkRef.current,
          );

          const snapshot = serializeEditorSnapshot(nextState.doc);
          const selection = getSelectionInfo(nextState);
          onSelectionChangeRef.current(selection);

          onDocumentSnapshotChangeRef.current(
            snapshot,
            transaction.docChanged ? serializeTransaction(transaction) : null,
          );
        },
        attributes: {
          class: "editor-prosemirror",
        },
        clipboardTextSerializer: serializeSlicePlainText,
        decorations: decorationSource(currentDecorationsRef),
      });

      const handleScroll = () => {
        const currentView = viewRef.current;
        if (!currentView) {
          return;
        }
        recomputeDecorations(
          currentView,
          surfaceRef.current,
          currentDecorationsRef,
          rulesRef.current,
          boundariesRef.current,
          pendingRangeRef.current,
          decorationsEnabledRef.current,
          boundariesEditableRef.current,
          onMatchingBenchmarkRef.current,
        );
      };

      const handleMouseMove = (event: MouseEvent) => {
        const target = event.target instanceof HTMLElement
          ? event.target.closest("[data-entity-id]") as HTMLElement | null
          : null;
        const entityId = target?.dataset.entityId ?? null;
        if (entityId) {
          lastEntityIdRef.current = entityId;
          onEntityHoverRef.current?.({ entityId, clientX: event.clientX, clientY: event.clientY });
        } else if (lastEntityIdRef.current !== null) {
          lastEntityIdRef.current = null;
          onEntityHoverRef.current?.(null);
        }
      };

      const handleMouseLeave = () => {
        lastEntityIdRef.current = null;
        onEntityHoverRef.current?.(null);
      };

      const handleClick = (event: MouseEvent) => {
        const target = event.target instanceof HTMLElement
          ? event.target.closest("[data-entity-id]") as HTMLElement | null
          : null;
        const entityId = target?.dataset.entityId;
        if (entityId) {
          onEntityClickRef.current?.(entityId);
        }
      };

      const handleBlur = () => {
        onBlurRef.current?.();
      };

      viewRef.current = view;
      recomputeDecorations(
        view,
        surfaceRef.current,
        currentDecorationsRef,
        rulesRef.current,
        boundariesRef.current,
        pendingRangeRef.current,
        decorationsEnabledRef.current,
        boundariesEditableRef.current,
        onMatchingBenchmarkRef.current,
      );
      onSelectionChangeRef.current(getSelectionInfo(view.state));
      onDocumentSnapshotChangeRef.current(serializeEditorSnapshot(view.state.doc), null);

      const currentSurface = surfaceRef.current;
      const dom = view.dom;
      currentSurface?.addEventListener("scroll", handleScroll);
      window.addEventListener("resize", handleScroll);
      dom.addEventListener("mousemove", handleMouseMove);
      dom.addEventListener("mouseleave", handleMouseLeave);
      dom.addEventListener("click", handleClick);
      dom.addEventListener("focusout", handleBlur);

      return () => {
        currentSurface?.removeEventListener("scroll", handleScroll);
        window.removeEventListener("resize", handleScroll);
        dom.removeEventListener("mousemove", handleMouseMove);
        dom.removeEventListener("mouseleave", handleMouseLeave);
        dom.removeEventListener("click", handleClick);
        dom.removeEventListener("focusout", handleBlur);
        view.destroy();
        viewRef.current = null;
      };
    }, []);

    useEffect(() => {
      const view = viewRef.current;
      if (!view) {
        return;
      }

      recomputeDecorations(
        view,
        surfaceRef.current,
        currentDecorationsRef,
        rulesRef.current,
        boundariesRef.current,
        pendingRangeRef.current,
        decorationsEnabledRef.current,
        boundariesEditableRef.current,
        onMatchingBenchmarkRef.current,
      );
    }, [props.decorationsEnabled, props.matchingRules, props.sliceBoundaries, props.pendingRange, props.boundariesEditable]);

    useImperativeHandle(ref, () => ({
      getSnapshot() {
        const view = viewRef.current;
        if (!view) {
          return serializeEditorSnapshot(basicSchema.nodeFromJSON(props.initialDocumentJson));
        }

        return serializeEditorSnapshot(view.state.doc);
      },
      getSelection() {
        const view = viewRef.current;
        return view ? getSelectionInfo(view.state) : { from: 0, to: 0, empty: true, text: "" };
      },
      focus() {
        viewRef.current?.focus();
      },
      selectAll() {
        const view = viewRef.current;
        if (!view) {
          return;
        }

        view.dispatch(view.state.tr.setSelection(new AllSelection(view.state.doc)));
        view.focus();
      },
      toggleBold() {
        toggleMarkFromHandle(viewRef.current, basicSchema.marks.strong);
      },
      toggleItalic() {
        toggleMarkFromHandle(viewRef.current, basicSchema.marks.em);
      },
      replaceSelection(text: string) {
        const view = viewRef.current;
        if (!view) {
          return null;
        }

        const { from, to } = view.state.selection;
        const tr = view.state.tr.insertText(text, from, to);
        view.dispatch(tr);
        view.focus();
        return {
          from,
          to: from + text.length,
        };
      },
    }));

    return (
      <div className="editor-frame">
        {props.showLegend !== false ? (
          <div className="editor-legend">
            <span className="legend-chip legend-chip--highlight">{props.legendLabels?.match ?? "Entity match"}</span>
            <span className="legend-chip legend-chip--boundary">{props.legendLabels?.boundary ?? "Slice boundary"}</span>
            <span className="legend-chip legend-chip--pending">{props.legendLabels?.pending ?? "Pending slice"}</span>
          </div>
        ) : null}
        <div className="editor-surface" ref={surfaceRef}>
          <div ref={containerRef} />
        </div>
      </div>
    );
  },
);

function createEditorState(documentJson: JsonObject): EditorState {
  return EditorState.create({
    schema: basicSchema,
    doc: basicSchema.nodeFromJSON(documentJson),
    plugins: [
      history(),
      keymap({
        "Mod-z": undo,
        "Mod-y": redo,
        "Mod-Shift-z": redo,
        "Mod-b": toggleMark(basicSchema.marks.strong),
        "Mod-i": toggleMark(basicSchema.marks.em),
      }),
      keymap(baseKeymap),
    ],
  });
}

function recomputeDecorations(
  view: EditorView,
  surface: HTMLDivElement | null,
  decorationRef: React.MutableRefObject<DecorationSet>,
  matchingRules: EditorMatchingRule[],
  sliceBoundaries: SliceBoundaryRecord[],
  pendingRange: PendingSliceRange | null,
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
    if (from >= to) {
      continue;
    }

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
  decorationRef: React.MutableRefObject<DecorationSet>,
): void {
  view.setProps({
    decorations: decorationSource(decorationRef),
  });
  view.updateState(view.state);
}

function decorationSource(
  decorationRef: React.MutableRefObject<DecorationSet>,
): ((state: EditorState) => DecorationSource | null) | undefined {
  return () => decorationRef.current;
}

function collectVisibleBlocks(
  view: EditorView,
  surface: HTMLDivElement,
): VisibleBlockRange[] {
  const bounds = surface.getBoundingClientRect();
  const visibleBlocks: VisibleBlockRange[] = [];

  view.state.doc.forEach((block, offset) => {
    const nodeDom = view.nodeDOM(offset) as HTMLElement | null;
    if (!nodeDom) {
      return;
    }

    const rect = nodeDom.getBoundingClientRect();
    if (rect.bottom < bounds.top || rect.top > bounds.bottom) {
      return;
    }

    visibleBlocks.push({
      from: offset + 1,
      to: offset + block.nodeSize - 1,
      text: block.textBetween(0, block.content.size, "\n\n"),
    });
  });

  return visibleBlocks;
}

function serializeEditorSnapshot(doc: ProseMirrorNode): HarnessEditorSnapshot {
  const plainText = serializeNodePlainText(doc);
  return {
    contentJson: doc.toJSON() as JsonObject,
    plainText,
    metrics: collectDocumentMetrics(plainText),
  };
}

function getSelectionInfo(state: EditorState): EditorSelectionInfo {
  const { from, to, empty } = state.selection;
  return {
    from,
    to,
    empty,
    text: empty ? "" : state.doc.textBetween(from, to, "\n\n"),
  };
}

function serializeTransaction(transaction: Transaction): SerializedTransactionBundle {
  const docs = (transaction as Transaction & { docs: ProseMirrorNode[] }).docs;
  return {
    steps: transaction.steps.map((step) => step.toJSON() as JsonObject),
    inverseSteps: transaction.steps.map((step, index) => step.invert(docs[index]!).toJSON() as JsonObject),
  };
}

function serializeNodePlainText(doc: ProseMirrorNode): string {
  return doc.textBetween(0, doc.content.size, "\n\n");
}

function serializeSlicePlainText(slice: Slice): string {
  return slice.content.textBetween(0, slice.content.size, "\n\n");
}

function toggleMarkFromHandle(view: EditorView | null, markType: MarkType | undefined): void {
  if (!view || !markType) {
    return;
  }

  const command = toggleMark(markType);
  command(view.state, view.dispatch, view);
  view.focus();
}
