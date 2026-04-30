import { useEffect } from "react";
import type { CSSProperties, MouseEvent } from "react";

import type { EditorContextMenuPayload } from "../../editor/HarnessEditor";
import type { EditorSelectionInfo } from "../../editor/editorUtils";
import { classNames } from "../../ui";
import styles from "./EditorActionOverlays.module.css";

type Props = {
  selection: EditorSelectionInfo;
  contextMenu: EditorContextMenuPayload | null;
  everlinkLabel: string;
  eversliceDisabled: boolean;
  highlightsEnabled: boolean;
  onBold: () => void;
  onItalic: () => void;
  onOpenEverlink: () => void;
  onOpenEverslice: () => void;
  onOpenEntityContext: (entityId: string) => void;
  onSelectEntity: (entityId: string) => void;
  onToggleHighlights: () => void;
  onCopySelection: () => void;
  onSelectAll: () => void;
  onCloseContextMenu: () => void;
};

export function EditorActionOverlays(props: Props) {
  const {
    selection,
    contextMenu,
    everlinkLabel,
    eversliceDisabled,
    highlightsEnabled,
    onBold,
    onItalic,
    onOpenEverlink,
    onOpenEverslice,
    onOpenEntityContext,
    onSelectEntity,
    onToggleHighlights,
    onCopySelection,
    onSelectAll,
    onCloseContextMenu,
  } = props;

  useEffect(() => {
    if (!contextMenu) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseContextMenu();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [contextMenu, onCloseContextMenu]);

  const selectionBubble =
    !contextMenu && !selection.empty && selection.anchor ? (
      <div
        className={styles.bubble}
        style={bubbleStyle(selection)}
        onMouseDown={keepEditorSelection}
      >
        <ActionButton label="B" title="Bold" onClick={onBold} strong />
        <ActionButton label="I" title="Italic" onClick={onItalic} italic />
        <ActionButton label={everlinkLabel} onClick={onOpenEverlink} />
        <ActionButton label="Everslice" onClick={onOpenEverslice} disabled={eversliceDisabled} />
        <ActionButton label="Copy" onClick={onCopySelection} />
      </div>
    ) : null;

  return (
    <>
      {selectionBubble}
      {contextMenu ? (
        <div className={styles.scrim} onMouseDown={onCloseContextMenu}>
          <div
            className={styles.menu}
            style={menuStyle(contextMenu)}
            onMouseDown={keepEditorSelection}
          >
            {contextMenu.entityId ? (
              <>
                <div className={styles.label}>Entity highlight</div>
                <ActionButton
                  label="Open Context"
                  onClick={() => onOpenEntityContext(contextMenu.entityId!)}
                />
                <ActionButton
                  label="Select Entity"
                  onClick={() => onSelectEntity(contextMenu.entityId!)}
                />
                <ActionButton
                  label={highlightsEnabled ? "Mute Highlights" : "Show Highlights"}
                  onClick={onToggleHighlights}
                />
              </>
            ) : null}
            {!contextMenu.selection.empty ? (
              <>
                <div className={styles.label}>Selected text</div>
                <ActionButton label="Bold" onClick={onBold} />
                <ActionButton label="Italic" onClick={onItalic} />
                <ActionButton label={everlinkLabel} onClick={onOpenEverlink} />
                <ActionButton
                  label="Everslice"
                  onClick={onOpenEverslice}
                  disabled={eversliceDisabled}
                />
                <ActionButton label="Copy" onClick={onCopySelection} />
                <ActionButton label="Select All" onClick={onSelectAll} />
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

function ActionButton({
  label,
  title,
  onClick,
  disabled,
  strong,
  italic,
}: {
  label: string;
  title?: string;
  onClick: () => void;
  disabled?: boolean;
  strong?: boolean;
  italic?: boolean;
}) {
  return (
    <button
      className={actionButtonClass(strong, italic)}
      disabled={disabled}
      onClick={onClick}
      title={title}
      type="button"
    >
      {label}
    </button>
  );
}

function actionButtonClass(strong?: boolean, italic?: boolean): string {
  return classNames(styles.action, strong && styles.strong, italic && styles.italic);
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

function menuStyle(contextMenu: EditorContextMenuPayload): CSSProperties {
  return {
    left: clamp(contextMenu.clientX, 12, window.innerWidth - 240),
    top: clamp(contextMenu.clientY, 88, window.innerHeight - 260),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
