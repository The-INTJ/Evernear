// Pure helpers around HarnessEditor's EditorView: building its state,
// serializing what it holds, and running commands from the imperative
// handle. No React here.

import { baseKeymap, toggleMark } from "prosemirror-commands";
import { history, redo, undo } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import type { MarkType, Node as ProseMirrorNode, Slice } from "prosemirror-model";
import { schema as basicSchema } from "prosemirror-schema-basic";
import { EditorState, type Transaction } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";

import {
  type DocumentMetrics,
  type JsonObject,
  collectDocumentMetrics,
} from "../../shared/domain/document";
import type {
  EditorSelectionAnchor,
  EditorSelectionInfo,
  SerializedTransactionBundle,
} from "./editorUtils";

export type HarnessEditorSnapshot = {
  contentJson: JsonObject;
  plainText: string;
  metrics: DocumentMetrics;
};

type EditorCommand = (
  state: EditorState,
  dispatch?: (transaction: Transaction) => void,
  view?: EditorView,
) => boolean;

export function createEditorState(documentJson: JsonObject): EditorState {
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

export function serializeEditorSnapshot(doc: ProseMirrorNode): HarnessEditorSnapshot {
  const plainText = serializeNodePlainText(doc);
  return {
    contentJson: doc.toJSON() as JsonObject,
    plainText,
    metrics: collectDocumentMetrics(plainText),
  };
}

export function getSelectionInfo(state: EditorState, view?: EditorView): EditorSelectionInfo {
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

export function scrollPositionIntoUpperThird(view: EditorView, surface: HTMLDivElement | null, position: number): void {
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

export function serializeTransaction(transaction: Transaction): SerializedTransactionBundle {
  const docs = (transaction as Transaction & { docs: ProseMirrorNode[] }).docs;
  return {
    steps: transaction.steps.map((step) => step.toJSON() as JsonObject),
    inverseSteps: transaction.steps.map((step, index) => step.invert(docs[index]!).toJSON() as JsonObject),
  };
}

function serializeNodePlainText(doc: ProseMirrorNode): string {
  return doc.textBetween(0, doc.content.size, "\n\n");
}

export function serializeSlicePlainText(slice: Slice): string {
  return slice.content.textBetween(0, slice.content.size, "\n\n");
}

export function toggleMarkFromHandle(view: EditorView | null, markType: MarkType | undefined): void {
  if (!view || !markType) {
    return;
  }

  const command = toggleMark(markType);
  runCommandFromHandle(view, command);
}

export function runCommandFromHandle(view: EditorView | null, command: EditorCommand): void {
  if (!view) {
    return;
  }
  command(view.state, view.dispatch, view);
  view.focus();
}
