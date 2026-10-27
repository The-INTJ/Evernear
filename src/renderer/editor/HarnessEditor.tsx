import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";

import { redo, undo } from "prosemirror-history";
import { schema as basicSchema } from "prosemirror-schema-basic";
import { AllSelection } from "prosemirror-state";
import { DecorationSet, EditorView } from "prosemirror-view";

import type { JsonObject } from "../../shared/domain/document";
import type {
  MatchingBenchmark,
  SliceBoundaryRecord,
} from "../../shared/domain/workspace";
import {
  type EditorMatchingRule,
  type EditorSelectionInfo,
  type SerializedTransactionBundle,
} from "./editorUtils";
import { decorationSource, recomputeDecorations } from "./editorDecorations";
import {
  type HarnessEditorSnapshot,
  createEditorState,
  getSelectionInfo,
  runCommandFromHandle,
  scrollPositionIntoUpperThird,
  serializeEditorSnapshot,
  serializeSlicePlainText,
  serializeTransaction,
  toggleMarkFromHandle,
} from "./editorState";
import { attachEntityHover, type EntityHoverPayload } from "./entityHover";
import { applyBoundaryDrag, attachBoundaryEditing, innermostSliceAt, type BoundaryDrag } from "./boundaryDrag";

export type { HarnessEditorSnapshot } from "./editorState";

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
  // Scrolls `pos` to the upper third of the surface without moving the
  // selection.
  scrollToPosition(pos: number): void;
  getScrollTop(): number;
  setScrollTop(top: number): void;
};

type HarnessEditorProps = {
  initialDocumentJson: JsonObject;
  decorationsEnabled: boolean;
  matchingRules?: EditorMatchingRule[];
  sliceBoundaries?: SliceBoundaryRecord[];
  // Edit slices: every slice gets start and end handles to drag, and
  // clicking inside a slice focuses it.
  boundariesEditable?: boolean;
  focusedSliceId?: string | null;
  pendingRange?: PendingSliceRange | null;
  onDocumentSnapshotChange(nextSnapshot: HarnessEditorSnapshot, transaction: SerializedTransactionBundle | null): void;
  onSelectionChange(selection: EditorSelectionInfo): void;
  onMatchingBenchmark?(benchmark: MatchingBenchmark): void;
  onEntityHover?(payload: EntityHoverPayload | null): void;
  onBoundaryChange?(sliceId: string, from: number, to: number): void;
  onSliceFocus?(sliceId: string | null): void;
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
    const onBoundaryChangeRef = useRef(props.onBoundaryChange);
    const onSliceFocusRef = useRef(props.onSliceFocus);
    const dragPreviewRef = useRef<BoundaryDrag | null>(null);
    const currentDecorationsRef = useRef<DecorationSet>(DecorationSet.empty);
    const rulesRef = useRef(props.matchingRules ?? []);
    const boundariesRef = useRef(props.sliceBoundaries ?? []);
    const pendingRangeRef = useRef(props.pendingRange ?? null);
    const decorationsEnabledRef = useRef(props.decorationsEnabled);
    const boundariesEditableRef = useRef(props.boundariesEditable ?? false);
    const focusedSliceIdRef = useRef(props.focusedSliceId ?? null);

    onDocumentSnapshotChangeRef.current = props.onDocumentSnapshotChange;
    onSelectionChangeRef.current = props.onSelectionChange;
    onMatchingBenchmarkRef.current = props.onMatchingBenchmark;
    onEntityHoverRef.current = props.onEntityHover;
    onBoundaryChangeRef.current = props.onBoundaryChange;
    onSliceFocusRef.current = props.onSliceFocus;
    rulesRef.current = props.matchingRules ?? [];
    boundariesRef.current = props.sliceBoundaries ?? [];
    pendingRangeRef.current = props.pendingRange ?? null;
    decorationsEnabledRef.current = props.decorationsEnabled;
    boundariesEditableRef.current = props.boundariesEditable ?? false;
    focusedSliceIdRef.current = props.focusedSliceId ?? null;

    // Reads everything through refs, so the copy captured by the mount
    // effect always sees current props.
    const redecorate = (view: EditorView) => {
      recomputeDecorations(view, surfaceRef.current, currentDecorationsRef, {
        matchingRules: rulesRef.current,
        sliceBoundaries: applyBoundaryDrag(boundariesRef.current, dragPreviewRef.current),
        pendingRange: pendingRangeRef.current,
        decorationsEnabled: decorationsEnabledRef.current,
        boundariesEditable: boundariesEditableRef.current,
        focusedSliceId: focusedSliceIdRef.current,
        onMatchingBenchmark: onMatchingBenchmarkRef.current,
      });
    };

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
          redecorate(currentView);
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
        redecorate(currentView);
        onSelectionChangeRef.current(getSelectionInfo(currentView.state, currentView));
      };

      viewRef.current = view;
      redecorate(view);
      onSelectionChangeRef.current(getSelectionInfo(view.state, view));
      onDocumentSnapshotChangeRef.current(serializeEditorSnapshot(view.state.doc), null);

      const currentSurface = surfaceRef.current;
      currentSurface?.addEventListener("scroll", handleScroll);
      window.addEventListener("resize", handleScroll);
      const detachEntityHover = attachEntityHover(view.dom, (payload) => onEntityHoverRef.current?.(payload));
      const detachBoundaryEditing = attachBoundaryEditing(view, () => ({
        isEditable: () => boundariesEditableRef.current,
        rangeOf: (sliceId) => {
          const boundary = boundariesRef.current.find((candidate) => candidate.sliceId === sliceId);
          return boundary ? { from: boundary.resolution.anchor.from, to: boundary.resolution.anchor.to } : null;
        },
        sliceAt: (pos) => innermostSliceAt(boundariesRef.current, pos),
        onPreview: (drag) => {
          dragPreviewRef.current = drag;
          redecorate(view);
        },
        onCommit: (sliceId, from, to) => onBoundaryChangeRef.current?.(sliceId, from, to),
        onFocusSlice: (sliceId) => onSliceFocusRef.current?.(sliceId),
      }));

      return () => {
        currentSurface?.removeEventListener("scroll", handleScroll);
        window.removeEventListener("resize", handleScroll);
        detachEntityHover();
        detachBoundaryEditing();
        view.destroy();
        viewRef.current = null;
      };
    }, []);

    useEffect(() => {
      const view = viewRef.current;
      if (!view) {
        return;
      }

      redecorate(view);
    }, [
      props.decorationsEnabled,
      props.matchingRules,
      props.sliceBoundaries,
      props.pendingRange,
      props.boundariesEditable,
      props.focusedSliceId,
    ]);

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
      scrollToPosition(pos: number) {
        const view = viewRef.current;
        if (!view) {
          return;
        }
        scrollPositionIntoUpperThird(view, surfaceRef.current, Math.max(0, Math.min(pos, view.state.doc.content.size)));
      },
      getScrollTop() {
        return surfaceRef.current?.scrollTop ?? 0;
      },
      setScrollTop(top: number) {
        if (surfaceRef.current) {
          surfaceRef.current.scrollTop = top;
        }
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
