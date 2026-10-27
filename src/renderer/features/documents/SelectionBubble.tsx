import type { CSSProperties, MouseEvent } from "react";

import type { EditorSelectionInfo } from "../../editor/editorUtils";
import styles from "./SelectionBubble.module.css";

type Props = {
  selection: EditorSelectionInfo;
  // The entity whose rule already matches the whole selection, if any.
  matchedEntity: { id: string; name: string } | null;
  onNewEntity: () => void;
  onEditEntity: (entityId: string) => void;
  onAddSlice: () => void;
};

// The two authoring actions, next to the selected text. Formatting keeps
// its keyboard shortcuts (Ctrl+B, Ctrl+I) instead of buttons here.
export function SelectionBubble({ selection, matchedEntity, onNewEntity, onEditEntity, onAddSlice }: Props) {
  if (selection.empty || !selection.anchor) return null;

  return (
    <div className={styles.bubble} style={bubbleStyle(selection)} onMouseDown={keepEditorSelection}>
      {matchedEntity ? (
        <button className={styles.action} type="button" onClick={() => onEditEntity(matchedEntity.id)}>
          {matchedEntity.name}
        </button>
      ) : (
        <button className={styles.action} type="button" onClick={onNewEntity}>
          New entity
        </button>
      )}
      <button className={styles.action} type="button" onClick={onAddSlice}>
        Add slice
      </button>
    </div>
  );
}

function keepEditorSelection(event: MouseEvent<HTMLElement>) {
  event.preventDefault();
  event.stopPropagation();
}

function bubbleStyle(selection: EditorSelectionInfo): CSSProperties {
  const anchor = selection.anchor;
  if (!anchor) return {};
  const left = clamp(anchor.left + anchor.width / 2, 16, window.innerWidth - 16);
  const top = clamp(anchor.top - 10, 80, window.innerHeight - 16);
  return { left, top };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
