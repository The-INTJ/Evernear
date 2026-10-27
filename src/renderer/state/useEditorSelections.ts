// Tracks the main editor's current selection. Add slice freezes it when
// the chooser opens; the selection bubble follows it.

import { useState } from "react";

import type { EditorSelectionInfo } from "../editor/editorUtils";

export type EditorSelectionsHook = {
  mainSelection: EditorSelectionInfo;
  setMainSelection: (selection: EditorSelectionInfo) => void;
};

const EMPTY_SELECTION: EditorSelectionInfo = { from: 0, to: 0, empty: true, text: "" };

export function useEditorSelections(): EditorSelectionsHook {
  const [mainSelection, setMainSelection] = useState<EditorSelectionInfo>(EMPTY_SELECTION);
  return { mainSelection, setMainSelection };
}
