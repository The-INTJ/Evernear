// Tracks the current selection in each editor surface. The pending
// placement hook consumes these to fill in start/end as the user clicks.

import { useCallback, useState } from "react";

import type { EditorSelectionInfo } from "../editor/editorUtils";

export type SelectionSurface = "main" | "panel";

export type EditorSelectionsHook = {
  mainSelection: EditorSelectionInfo;
  panelSelection: EditorSelectionInfo;
  setSelection: (surface: SelectionSurface, selection: EditorSelectionInfo) => void;
};

const EMPTY_SELECTION: EditorSelectionInfo = { from: 0, to: 0, empty: true, text: "" };

export function useEditorSelections(): EditorSelectionsHook {
  const [mainSelection, setMainSelection] = useState<EditorSelectionInfo>(EMPTY_SELECTION);
  const [panelSelection, setPanelSelection] = useState<EditorSelectionInfo>(EMPTY_SELECTION);

  const setSelection = useCallback((surface: SelectionSurface, selection: EditorSelectionInfo) => {
    if (surface === "main") {
      setMainSelection(selection);
    } else {
      setPanelSelection(selection);
    }
  }, []);

  return { mainSelection, panelSelection, setSelection };
}
