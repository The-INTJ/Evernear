import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";

import { baseKeymap, toggleMark } from "prosemirror-commands";
import { history, redo, undo } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import { schema as basicSchema } from "prosemirror-schema-basic";
import { AllSelection, EditorState, type Transaction } from "prosemirror-state";
import type { MarkType, Node as ProseMirrorNode, Slice } from "prosemirror-model";
import { Decoration, DecorationSet, EditorView, type DecorationSource } from "prosemirror-view";

import {
  type DocumentMetrics,
  type JsonObject,
  collectDocumentMetrics,
} from "../../shared/domain/document";
import type {
  AnchorProbeRecord,
  MatchingBenchmark,
  MatchingRuleRecord,
} from "../../shared/domain/workbench";
import {
  type EditorSelectionInfo,
  type SerializedTransactionBundle,
  collectMatchesForVisibleBlocks,
  type VisibleBlockRange,
} from "./workbenchUtils";

export type HarnessEditorSnapshot = {
  contentJson: JsonObject;
  plainText: string;
  metrics: DocumentMetrics;
};

export type HarnessEditorHandle = {
  getSnapshot(): HarnessEditorSnapshot;
  getSelection(): EditorSelectionInfo;
  focus(): void;
  selectAll(): void;
  toggleBold(): void;
  toggleItalic(): void;
};

type HarnessEditorProps = {
  initialDocumentJson: JsonObject;
  decorationsEnabled: boolean;
  matchingRules?: MatchingRuleRecord[];
  anchorProbes?: AnchorProbeRecord[];
  showLegend?: boolean;
  onDocumentSnapshotChange(nextSnapshot: HarnessEditorSnapshot, transaction: SerializedTransactionBundle | null): void;
  onSelectionChange(selection: EditorSelectionInfo): void;
  onMatchingBenchmark?(benchmark: MatchingBenchmark): void;
};

export const HarnessEditor = forwardRef<HarnessEditorHandle, HarnessEditorProps>(
  function HarnessEditor(props, ref) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const surfaceRef = useRef<HTMLDivElement | null>(null);
    const viewRef = useRef<EditorView | null>(null);
    const onDocumentSnapshotChangeRef = useRef(props.onDocumentSnapshotChange);
    const onSelectionChangeRef = useRef(props.onSelectionChange);
    const onMatchingBenchmarkRef = useRef(props.onMatchingBenchmark);
    const currentDecorationsRef = useRef<DecorationSet>(DecorationSet.empty);
    const rulesRef = useRef(props.matchingRules ?? []);
    const probesRef = useRef(props.anchorProbes ?? []);
    const decorationsEnabledRef = useRef(props.decorationsEnabled);

    onDocumentSnapshotChangeRef.current = props.onDocumentSnapshotChange;
    onSelectionChangeRef.current = props.onSelectionChange;
    onMatchingBenchmarkRef.current = props.onMatchingBenchmark;
    rulesRef.current = props.matchingRules ?? [];
    probesRef.current = props.anchorProbes ?? [];
    decorationsEnabledRef.current = props.decorationsEnabled;

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
          recomputeDecorations(currentView, surfaceRef.current, currentDecorationsRef, rulesRef.current, probesRef.current, decorationsEnabledRef.current, onMatchingBenchmarkRef.current);

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

      viewRef.current = view;
      recomputeDecorations(view, surfaceRef.current, currentDecorationsRef, rulesRef.current, probesRef.current, decorationsEnabledRef.current, onMatchingBenchmarkRef.current);
      onSelectionChangeRef.current(getSelectionInfo(view.state));
      onDocumentSnapshotChangeRef.current(serializeEditorSnapshot(view.state.doc), null);

      const handleScroll = () => {
        const currentView = viewRef.current;
        if (!currentView) {
          return;
        }
        recomputeDecorations(currentView, surfaceRef.current, currentDecorationsRef, rulesRef.current, probesRef.current, decorationsEnabledRef.current, onMatchingBenchmarkRef.current);
      };

      const currentSurface = surfaceRef.current;
      currentSurface?.addEventListener("scroll", handleScroll);
      window.addEventListener("resize", handleScroll);

      return () => {
        currentSurface?.removeEventListener("scroll", handleScroll);
        window.removeEventListener("resize", handleScroll);
        view.destroy();
        viewRef.current = null;
      };
    }, []);

    useEffect(() => {
      const view = viewRef.current;
      if (!view) {
        return;
      }

      recomputeDecorations(view, surfaceRef.current, currentDecorationsRef, rulesRef.current, probesRef.current, decorationsEnabledRef.current, onMatchingBenchmarkRef.current);
    }, [props.decorationsEnabled, props.matchingRules, props.anchorProbes]);

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
    }));

    return (
      <div className="editor-frame">
        {props.showLegend !== false ? (
          <div className="editor-legend">
            <span className="legend-chip legend-chip--highlight">Visible-range match</span>
            <span className="legend-chip legend-chip--boundary">Slice boundary</span>
            <span className="legend-chip legend-chip--annotation">Link</span>
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
  matchingRules: MatchingRuleRecord[],
  anchorProbes: AnchorProbeRecord[],
  decorationsEnabled: boolean,
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
      }),
    );
  }

  for (const probe of anchorProbes) {
    const { from, to } = probe.resolution.anchor;
    if (from >= to || probe.resolution.status === "invalid") {
      continue;
    }

    const className = probe.kind === "boundary"
      ? `pm-anchor-boundary pm-anchor-${probe.resolution.status}`
      : `pm-anchor-annotation pm-anchor-${probe.resolution.status}`;

    decorations.push(
      Decoration.inline(from, to, { class: className }),
    );
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
