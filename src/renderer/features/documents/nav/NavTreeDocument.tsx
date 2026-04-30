import { useDraggable, useDroppable } from "@dnd-kit/core";
import type { CSSProperties, MouseEvent } from "react";

import type { DocumentSummary } from "../../../../shared/domain/workspace";
import { classNames } from "../../../ui";
import { NavInlineRename } from "./NavInlineRename";
import { buildDragId, buildDropZoneId } from "./useNavTreeDnd";
import styles from "./NavTree.module.css";

type Props = {
  document: DocumentSummary;
  active: boolean;
  depth: number;
  isRenaming: boolean;
  hoverZone: "above" | "below" | null;
  onOpen: (documentId: string) => void;
  onContextMenu: (event: MouseEvent<HTMLButtonElement>, document: DocumentSummary) => void;
  onCommitRename: (document: DocumentSummary, value: string) => void;
  onCancelRename: () => void;
};

export function NavTreeDocument(props: Props) {
  const {
    document,
    active,
    depth,
    isRenaming,
    hoverZone,
    onOpen,
    onContextMenu,
    onCommitRename,
    onCancelRename,
  } = props;

  const draggable = useDraggable({ id: buildDragId("doc", document.id) });
  const aboveDroppable = useDroppable({ id: buildDropZoneId("above", "doc", document.id) });
  const belowDroppable = useDroppable({ id: buildDropZoneId("below", "doc", document.id) });

  const indentStyle: CSSProperties = {
    paddingLeft: `calc(var(--space-4) + ${depth} * var(--nav-indent))`,
  };

  return (
    <div className={styles.row} ref={draggable.setNodeRef}>
      {isRenaming ? (
        <div
          className={classNames(styles.documentRow, active && styles.documentRowActive, styles.documentRowEditing)}
          style={indentStyle}
        >
          <span className={styles.documentIcon} aria-hidden="true" />
          <NavInlineRename
            initialValue={document.title}
            ariaLabel="Document name"
            onCommit={(value) => onCommitRename(document, value)}
            onCancel={onCancelRename}
          />
        </div>
      ) : (
        <button
          className={classNames(
            styles.documentRow,
            active && styles.documentRowActive,
            draggable.isDragging && styles.rowDragging,
          )}
          style={indentStyle}
          onClick={() => onOpen(document.id)}
          onContextMenu={(event) => onContextMenu(event, document)}
          type="button"
          {...draggable.attributes}
          {...draggable.listeners}
        >
          <span className={styles.documentIcon} aria-hidden="true" />
          <span className={styles.documentTitle}>{document.title}</span>
        </button>
      )}
      <div ref={aboveDroppable.setNodeRef} className={classNames(styles.zoneAbove)} />
      <div ref={belowDroppable.setNodeRef} className={classNames(styles.zoneBelow)} />
      {hoverZone === "above" ? <div className={styles.indicatorAbove} /> : null}
      {hoverZone === "below" ? <div className={styles.indicatorBelow} /> : null}
    </div>
  );
}
