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
import { AllSelection, EditorState, TextSelection, type Transaction } from "prosemirror-state";
import { DecorationSet, EditorView } from "prosemirror-view";

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
  type EditorSelectionAnchor,
  type EditorSelectionInfo,
  type SerializedTransactionBundle,
} from "./editorUtils";
import { decorationSource, recomputeDecorations } from "./editorDecorations";

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
  undo(): void;
  redo(): void;
  toggleBold(): void;
  toggleItalic(): void;
  replaceSelection(text: string): { from: number; to: number } | null;
  // Selects [from, to] and scrolls it to the upper third of the surface.
  revealRange(from: number, to: number): void;
};

type EditorCommand = (
  state: EditorState,
  dispatch?: (transaction: Transaction) => void,
  view?: EditorView,
) => boolean;

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
  onDocumentSnapshotChange(nextSnapshot: HarnessEditorSnapshot, transaction: SerializedTransactionBundle | null): void;
  onSelectionChange(selection: EditorSelectionInfo): void;
  onMatchingBenchmark?(benchmark: MatchingBenchmark): void;
  onEntityHover?(payload: { entityId: string; clientX: number; clientY: number } | null): void;
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
          // Persist before decorating: prose must reach the save queue even
          // if a highlight pass fails.
          onDocumentSnapshotChangeRef.current(
            serializeEditorSnapshot(nextState.doc),
            transaction.docChanged ? serializeTransaction(transaction) : null,
          );
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
          onSelectionChangeRef.current(getSelectionInfo(nextState, currentView));
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
        onSelectionChangeRef.current(getSelectionInfo(currentView.state, currentView));
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
      onSelectionChangeRef.current(getSelectionInfo(view.state, view));
      onDocumentSnapshotChangeRef.current(serializeEditorSnapshot(view.state.doc), null);

      const currentSurface = surfaceRef.current;
      const dom = view.dom;
      currentSurface?.addEventListener("scroll", handleScroll);
      window.addEventListener("resize", handleScroll);
      dom.addEventListener("mousemove", handleMouseMove);
      dom.addEventListener("mouseleave", handleMouseLeave);

      return () => {
        currentSurface?.removeEventListener("scroll", handleScroll);
        window.removeEventListener("resize", handleScroll);
        dom.removeEventListener("mousemove", handleMouseMove);
        dom.removeEventListener("mouseleave", handleMouseLeave);
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
        return view ? getSelectionInfo(view.state, view) : { from: 0, to: 0, empty: true, text: "", anchor: null };
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
      undo() {
        runCommandFromHandle(viewRef.current, undo);
      },
      redo() {
        runCommandFromHandle(viewRef.current, redo);
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
      revealRange(from: number, to: number) {
        const view = viewRef.current;
        if (!view) {
          return;
        }

        const size = view.state.doc.content.size;
        const start = Math.max(0, Math.min(from, size));
        const end = Math.max(start, Math.min(to, size));
        view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, start, end)));
        view.focus();
        scrollPositionIntoUpperThird(view, surfaceRef.current, start);
      },
    }));

    return (
      <div className="editor-frame">
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

function serializeEditorSnapshot(doc: ProseMirrorNode): HarnessEditorSnapshot {
  const plainText = serializeNodePlainText(doc);
  return {
    contentJson: doc.toJSON() as JsonObject,
    plainText,
    metrics: collectDocumentMetrics(plainText),
  };
}

function getSelectionInfo(state: EditorState, view?: EditorView): EditorSelectionInfo {
  const { from, to, empty } = state.selection;
  return {
    from,
    to,
    empty,
    text: empty ? "" : state.doc.textBetween(from, to, "\n\n"),
    anchor: empty || !view ? null : getSelectionAnchor(view, from, to),
  };
}

function getSelectionAnchor(view: EditorView, from: number, to: number): EditorSelectionAnchor | null {
  try {
    const start = view.coordsAtPos(from);
    const end = view.coordsAtPos(to);
    const left = Math.min(start.left, end.left);
    const right = Math.max(start.right, end.right);
    const top = Math.min(start.top, end.top);
    const bottom = Math.max(start.bottom, end.bottom);
    return {
      left,
      top,
      width: Math.max(1, right - left),
      height: Math.max(1, bottom - top),
    };
  } catch {
    return null;
  }
}

function scrollPositionIntoUpperThird(view: EditorView, surface: HTMLDivElement | null, position: number): void {
  if (!surface) {
    return;
  }
  try {
    const coords = view.coordsAtPos(position);
    const bounds = surface.getBoundingClientRect();
    surface.scrollTop += coords.top - bounds.top - bounds.height / 3;
  } catch {
    // coordsAtPos throws for positions the view hasn't rendered; the
    // selection is still set, so the caret is where the author expects.
  }
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
  runCommandFromHandle(view, command);
}

function runCommandFromHandle(view: EditorView | null, command: EditorCommand): void {
  if (!view) {
    return;
  }
  command(view.state, view.dispatch, view);
  view.focus();
}
