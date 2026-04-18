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
import { AllSelection, EditorState } from "prosemirror-state";
import type { MarkType, Node as ProseMirrorNode, Slice } from "prosemirror-model";
import { Decoration, DecorationSet, EditorView, type DecorationSource } from "prosemirror-view";

import {
  type DocumentMetrics,
  type JsonObject,
  collectDocumentMetrics,
} from "../../shared/domain/document";

export type HarnessEditorSnapshot = {
  contentJson: JsonObject;
  plainText: string;
  metrics: DocumentMetrics;
};

export type HarnessEditorHandle = {
  getSnapshot(): HarnessEditorSnapshot;
  focus(): void;
  selectAll(): void;
  toggleBold(): void;
  toggleItalic(): void;
};

type HarnessEditorProps = {
  initialDocumentJson: JsonObject;
  decorationsEnabled: boolean;
  onDocumentChange(nextSnapshot: HarnessEditorSnapshot): void;
};

const highlightTerms = [
  "Aurelia Vale",
  "Captain Elian Rook",
  "White Harbor",
  "Ashmere",
  "Glass Archive",
  "Larkspur Gate",
];

export const HarnessEditor = forwardRef<HarnessEditorHandle, HarnessEditorProps>(
  function HarnessEditor(props, ref) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const viewRef = useRef<EditorView | null>(null);
    const onDocumentChangeRef = useRef(props.onDocumentChange);

    onDocumentChangeRef.current = props.onDocumentChange;

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

          if (transaction.docChanged) {
            onDocumentChangeRef.current(serializeEditorSnapshot(nextState.doc));
          }
        },
        attributes: {
          class: "editor-prosemirror",
        },
        clipboardTextSerializer: serializeSlicePlainText,
        decorations: createDecorationSource(props.decorationsEnabled),
      });

      viewRef.current = view;
      onDocumentChangeRef.current(serializeEditorSnapshot(view.state.doc));

      return () => {
        view.destroy();
        viewRef.current = null;
      };
    }, []);

    useEffect(() => {
      const view = viewRef.current;
      if (!view) {
        return;
      }

      view.setProps({
        decorations: createDecorationSource(props.decorationsEnabled),
      });
    }, [props.decorationsEnabled]);

    useImperativeHandle(ref, () => ({
      getSnapshot() {
        const view = viewRef.current;
        if (!view) {
          return serializeEditorSnapshot(basicSchema.nodeFromJSON(props.initialDocumentJson));
        }

        return serializeEditorSnapshot(view.state.doc);
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
        <div className="editor-legend">
          <span className="legend-chip legend-chip--highlight">Derived highlight</span>
          <span className="legend-chip legend-chip--boundary">Boundary rail</span>
        </div>
        <div className="editor-surface" ref={containerRef} />
      </div>
    );
  },
);

function createEditorState(
  documentJson: JsonObject,
): EditorState {
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

function createDecorationSource(
  decorationsEnabled: boolean,
): ((state: EditorState) => DecorationSource | null) | undefined {
  if (!decorationsEnabled) {
    return undefined;
  }

  return (state) => buildDecorations(state.doc);
}

function buildDecorations(doc: ProseMirrorNode): DecorationSet {
  const decorations: Decoration[] = [];
  let paragraphIndex = 0;

  doc.descendants((node, position) => {
    if (node.isText) {
      const text = node.text ?? "";

      for (const term of highlightTerms) {
        let searchStart = 0;

        while (searchStart < text.length) {
          const index = text.indexOf(term, searchStart);
          if (index === -1) {
            break;
          }

          decorations.push(
            Decoration.inline(position + index, position + index + term.length, {
              class: "pm-highlight-derived",
            }),
          );
          searchStart = index + term.length;
        }
      }

      return false;
    }

    if (node.type.name === "paragraph") {
      if (paragraphIndex % 14 === 5 || paragraphIndex % 14 === 11) {
        decorations.push(
          Decoration.node(position, position + node.nodeSize, {
            class: "pm-simulated-boundary",
          }),
        );
      }

      paragraphIndex += 1;
    }

    return true;
  });

  return DecorationSet.create(doc, decorations);
}

function serializeEditorSnapshot(doc: ProseMirrorNode): HarnessEditorSnapshot {
  const plainText = serializeNodePlainText(doc);
  return {
    contentJson: doc.toJSON() as JsonObject,
    plainText,
    metrics: collectDocumentMetrics(plainText),
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
