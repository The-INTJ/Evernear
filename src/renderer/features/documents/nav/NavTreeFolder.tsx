import { useDraggable, useDroppable } from "@dnd-kit/core";
import type { CSSProperties, MouseEvent } from "react";

import type {
  DocumentFolderRecord,
  DocumentSummary,
} from "../../../../shared/domain/workspace";
import { classNames } from "../../../ui";
import { NavInlineRename } from "./NavInlineRename";
import { NavTreeDocument } from "./NavTreeDocument";
import { buildDragId, buildDropZoneId } from "./useNavTreeDnd";
import type { NavTreeStructure } from "./useNavTreeStructure";
import styles from "./NavTree.module.css";

type DropZone = "above" | "onto" | "below";
type HoverTarget = {
  kind: "folder" | "doc" | "unfiled";
  id: string | null;
  zone: DropZone;
};

type Props = {
  folder: DocumentFolderRecord;
  depth: number;
  expanded: boolean;
  activeDocumentId: string | null;
  renamingFolderId: string | null;
  renamingDocumentId: string | null;
  hoverTarget: HoverTarget | null;
  structure: NavTreeStructure;
  expandedFolderIds: string[];
  onToggle: (folderId: string) => void;
  onContextMenuFolder: (event: MouseEvent<HTMLElement>, folder: DocumentFolderRecord) => void;
  onContextMenuDocument: (event: MouseEvent<HTMLButtonElement>, document: DocumentSummary) => void;
  onOpenDocument: (documentId: string) => void;
  onCommitFolderRename: (folder: DocumentFolderRecord, value: string) => void;
  onCancelFolderRename: () => void;
  onCommitDocumentRename: (document: DocumentSummary, value: string) => void;
  onCancelDocumentRename: () => void;
};

export function NavTreeFolder(props: Props) {
  const {
    folder,
    depth,
    expanded,
    activeDocumentId,
    renamingFolderId,
    renamingDocumentId,
    hoverTarget,
    structure,
    expandedFolderIds,
    onToggle,
    onContextMenuFolder,
    onContextMenuDocument,
    onOpenDocument,
    onCommitFolderRename,
    onCancelFolderRename,
    onCommitDocumentRename,
    onCancelDocumentRename,
  } = props;

  const isRenaming = renamingFolderId === folder.id;
  const folderZone =
    hoverTarget && hoverTarget.kind === "folder" && hoverTarget.id === folder.id
      ? hoverTarget.zone
      : null;

  const draggable = useDraggable({ id: buildDragId("folder", folder.id) });
  const aboveDroppable = useDroppable({ id: buildDropZoneId("above", "folder", folder.id) });
  const ontoDroppable = useDroppable({ id: buildDropZoneId("onto", "folder", folder.id) });
  const belowDroppable = useDroppable({ id: buildDropZoneId("below", "folder", folder.id) });

  const childFolders = (structure.childrenByParentId.get(folder.id) ?? [])
    .slice()
    .sort((a, b) => a.ordering - b.ordering);
  const childDocuments = (structure.documentsByFolderId.get(folder.id) ?? [])
    .slice()
    .sort((a, b) => a.ordering - b.ordering);
  const childCount = childFolders.length + childDocuments.length;

  const indentStyle: CSSProperties = {
    paddingLeft: `calc(var(--space-4) + ${depth} * var(--nav-indent))`,
  };

  return (
    <div className={styles.folderBlock}>
      <div className={styles.row} ref={draggable.setNodeRef}>
        {isRenaming ? (
          <div
            className={classNames(
              styles.folderRow,
              expanded && styles.folderRowExpanded,
              styles.folderRowEditing,
            )}
            style={indentStyle}
          >
            <span className={styles.disclosure} aria-hidden="true" />
            <span className={styles.folderIcon} aria-hidden="true" />
            <NavInlineRename
              initialValue={folder.title}
              ariaLabel="Folder name"
              onCommit={(value) => onCommitFolderRename(folder, value)}
              onCancel={onCancelFolderRename}
            />
          </div>
        ) : (
          <button
            className={classNames(
              styles.folderRow,
              expanded && styles.folderRowExpanded,
              draggable.isDragging && styles.rowDragging,
              folderZone === "onto" && styles.folderRowDropOnto,
            )}
            style={indentStyle}
            onClick={() => onToggle(folder.id)}
            onContextMenu={(event) => onContextMenuFolder(event, folder)}
            type="button"
            {...draggable.attributes}
            {...draggable.listeners}
          >
            <span className={styles.disclosure} aria-hidden="true" />
            <span className={styles.folderIcon} aria-hidden="true" />
            <span className={styles.folderName}>{folder.title}</span>
            <span className={styles.count}>{childCount}</span>
          </button>
        )}
        <div ref={aboveDroppable.setNodeRef} className={styles.zoneAboveFolder} />
        <div ref={ontoDroppable.setNodeRef} className={styles.zoneOnto} />
        <div ref={belowDroppable.setNodeRef} className={styles.zoneBelowFolder} />
        {folderZone === "above" ? <div className={styles.indicatorAbove} /> : null}
        {folderZone === "below" ? <div className={styles.indicatorBelow} /> : null}
      </div>
      {expanded ? (
        <div className={styles.childList}>
          {childFolders.map((child) => (
            <NavTreeFolder
              key={child.id}
              folder={child}
              depth={depth + 1}
              expanded={expandedFolderIds.includes(child.id)}
              activeDocumentId={activeDocumentId}
              renamingFolderId={renamingFolderId}
              renamingDocumentId={renamingDocumentId}
              hoverTarget={hoverTarget}
              structure={structure}
              expandedFolderIds={expandedFolderIds}
              onToggle={onToggle}
              onContextMenuFolder={onContextMenuFolder}
              onContextMenuDocument={onContextMenuDocument}
              onOpenDocument={onOpenDocument}
              onCommitFolderRename={onCommitFolderRename}
              onCancelFolderRename={onCancelFolderRename}
              onCommitDocumentRename={onCommitDocumentRename}
              onCancelDocumentRename={onCancelDocumentRename}
            />
          ))}
          {childDocuments.map((doc) => {
            const docZone =
              hoverTarget && hoverTarget.kind === "doc" && hoverTarget.id === doc.id
                ? (hoverTarget.zone === "above" || hoverTarget.zone === "below" ? hoverTarget.zone : null)
                : null;
            return (
              <NavTreeDocument
                key={doc.id}
                document={doc}
                active={doc.id === activeDocumentId}
                depth={depth + 1}
                isRenaming={renamingDocumentId === doc.id}
                hoverZone={docZone}
                onOpen={onOpenDocument}
                onContextMenu={onContextMenuDocument}
                onCommitRename={onCommitDocumentRename}
                onCancelRename={onCancelDocumentRename}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
