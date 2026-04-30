import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  pointerWithin,
  useDroppable,
} from "@dnd-kit/core";
import { useEffect, useState } from "react";
import type { MouseEvent } from "react";

import type {
  DocumentFolderRecord,
  DocumentSummary,
  WorkspaceState,
} from "../../../../shared/domain/workspace";
import type { StoredDocumentSnapshot } from "../../../../shared/domain/document";
import { classNames } from "../../../ui";
import { NavContextMenu, type NavContextTarget } from "./NavContextMenu";
import { NavTreeDocument } from "./NavTreeDocument";
import { NavTreeFolder } from "./NavTreeFolder";
import { buildDropZoneId, useNavTreeDnd } from "./useNavTreeDnd";
import { useNavTreeStructure } from "./useNavTreeStructure";
import styles from "./NavTree.module.css";

type Props = {
  workspace: WorkspaceState | null;
  activeDocument: StoredDocumentSnapshot | null;
  onCreateFolder: (parentFolderId: string | null) => void;
  onCreateDocument: (folderId: string | null) => void;
  onOpenDocument: (documentId: string) => void;
  onToggleFolder: (folderId: string) => void;
  onRenameFolder: (folder: DocumentFolderRecord, title: string) => void;
  onRenameDocument: (document: DocumentSummary, title: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onDeleteDocument: (documentId: string, title: string) => void;
  onMoveFolder: (folderId: string, newParentFolderId: string | null, beforeFolderId: string | null) => void;
  onMoveDocument: (documentId: string, newFolderId: string | null, beforeDocumentId: string | null) => void;
};

export function NavTree(props: Props) {
  const {
    workspace,
    activeDocument,
    onCreateFolder,
    onCreateDocument,
    onOpenDocument,
    onToggleFolder,
    onRenameFolder,
    onRenameDocument,
    onDeleteFolder,
    onDeleteDocument,
    onMoveFolder,
    onMoveDocument,
  } = props;

  const folders = workspace?.folders ?? [];
  const documents = workspace?.documents ?? [];
  const expandedFolderIds = workspace?.layout.expandedFolderIds ?? [];

  const structure = useNavTreeStructure(folders, documents);
  const dnd = useNavTreeDnd({
    structure,
    expandedFolderIds,
    onToggleFolder,
    onMoveFolder,
    onMoveDocument,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; target: NavContextTarget } | null>(null);
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renamingDocumentId, setRenamingDocumentId] = useState<string | null>(null);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [contextMenu]);

  const openContextMenuForFolder = (event: MouseEvent<HTMLElement>, folder: DocumentFolderRecord) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ x: event.clientX, y: event.clientY, target: { kind: "folder", folder } });
  };

  const openContextMenuForDocument = (event: MouseEvent<HTMLButtonElement>, document: DocumentSummary) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ x: event.clientX, y: event.clientY, target: { kind: "document", document } });
  };

  const openContextMenuForRoot = (event: MouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ x: event.clientX, y: event.clientY, target: { kind: "root" } });
  };

  const openContextMenuForUnfiled = (event: MouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ x: event.clientX, y: event.clientY, target: { kind: "unfiled" } });
  };

  const commitFolderRename = (folder: DocumentFolderRecord, value: string) => {
    setRenamingFolderId(null);
    const trimmed = value.trim();
    if (!trimmed || trimmed === folder.title) return;
    onRenameFolder(folder, trimmed);
  };

  const commitDocumentRename = (document: DocumentSummary, value: string) => {
    setRenamingDocumentId(null);
    const trimmed = value.trim();
    if (!trimmed || trimmed === document.title) return;
    onRenameDocument(document, trimmed);
  };

  const rootFolders = structure.rootFolders.slice().sort((a, b) => a.ordering - b.ordering);
  const unfiledDocuments = (structure.documentsByFolderId.get(null) ?? [])
    .slice()
    .sort((a, b) => a.ordering - b.ordering);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={dnd.handleDragStart}
      onDragOver={dnd.handleDragOver}
      onDragCancel={dnd.handleDragCancel}
      onDragEnd={dnd.handleDragEnd}
    >
      <div className={styles.tree} onContextMenu={openContextMenuForRoot}>
        {rootFolders.map((folder) => (
          <NavTreeFolder
            key={folder.id}
            folder={folder}
            depth={0}
            expanded={expandedFolderIds.includes(folder.id)}
            activeDocumentId={activeDocument?.id ?? null}
            renamingFolderId={renamingFolderId}
            renamingDocumentId={renamingDocumentId}
            hoverTarget={dnd.hoverTarget}
            structure={structure}
            expandedFolderIds={expandedFolderIds}
            onToggle={onToggleFolder}
            onContextMenuFolder={openContextMenuForFolder}
            onContextMenuDocument={openContextMenuForDocument}
            onOpenDocument={onOpenDocument}
            onCommitFolderRename={commitFolderRename}
            onCancelFolderRename={() => setRenamingFolderId(null)}
            onCommitDocumentRename={commitDocumentRename}
            onCancelDocumentRename={() => setRenamingDocumentId(null)}
          />
        ))}

        {unfiledDocuments.length > 0 ? (
          <UnfiledSection
            documents={unfiledDocuments}
            activeDocumentId={activeDocument?.id ?? null}
            renamingDocumentId={renamingDocumentId}
            hoverTarget={dnd.hoverTarget}
            onContextMenuRow={openContextMenuForUnfiled}
            onContextMenuDocument={openContextMenuForDocument}
            onOpenDocument={onOpenDocument}
            onCommitRename={commitDocumentRename}
            onCancelRename={() => setRenamingDocumentId(null)}
          />
        ) : null}
      </div>

      {contextMenu ? (
        <NavContextMenu
          position={{ x: contextMenu.x, y: contextMenu.y }}
          target={contextMenu.target}
          onCreateFolder={(parentFolderId) => {
            setContextMenu(null);
            onCreateFolder(parentFolderId);
          }}
          onCreateDocument={(folderId) => {
            setContextMenu(null);
            onCreateDocument(folderId);
          }}
          onRequestRenameFolder={(folder) => {
            setContextMenu(null);
            setRenamingFolderId(folder.id);
          }}
          onRequestRenameDocument={(document) => {
            setContextMenu(null);
            setRenamingDocumentId(document.id);
          }}
          onDeleteFolder={(folderId) => {
            setContextMenu(null);
            onDeleteFolder(folderId);
          }}
          onDeleteDocument={(documentId, title) => {
            setContextMenu(null);
            onDeleteDocument(documentId, title);
          }}
        />
      ) : null}
    </DndContext>
  );
}

type UnfiledSectionProps = {
  documents: DocumentSummary[];
  activeDocumentId: string | null;
  renamingDocumentId: string | null;
  hoverTarget: ReturnType<typeof useNavTreeDnd>["hoverTarget"];
  onContextMenuRow: (event: MouseEvent<HTMLElement>) => void;
  onContextMenuDocument: (event: MouseEvent<HTMLButtonElement>, document: DocumentSummary) => void;
  onOpenDocument: (documentId: string) => void;
  onCommitRename: (document: DocumentSummary, value: string) => void;
  onCancelRename: () => void;
};

function UnfiledSection(props: UnfiledSectionProps) {
  const ontoDroppable = useDroppable({ id: buildDropZoneId("onto", "unfiled", null) });
  const isHovered =
    props.hoverTarget && props.hoverTarget.kind === "unfiled" && props.hoverTarget.zone === "onto";

  return (
    <div className={styles.folderBlock} onContextMenu={props.onContextMenuRow}>
      <div
        className={classNames(styles.folderRow, styles.folderRowStatic, isHovered && styles.folderRowDropOnto)}
        ref={ontoDroppable.setNodeRef}
      >
        <span className={classNames(styles.disclosure, styles.disclosureEmpty)} aria-hidden="true" />
        <span className={styles.folderIcon} aria-hidden="true" />
        <span className={styles.folderName}>Unfiled Documents</span>
        <span className={styles.count}>{props.documents.length}</span>
      </div>
      <div className={styles.childList}>
        {props.documents.map((doc) => {
          const docZone =
            props.hoverTarget && props.hoverTarget.kind === "doc" && props.hoverTarget.id === doc.id
              ? (props.hoverTarget.zone === "above" || props.hoverTarget.zone === "below" ? props.hoverTarget.zone : null)
              : null;
          return (
            <NavTreeDocument
              key={doc.id}
              document={doc}
              active={doc.id === props.activeDocumentId}
              depth={1}
              isRenaming={props.renamingDocumentId === doc.id}
              hoverZone={docZone}
              onOpen={props.onOpenDocument}
              onContextMenu={props.onContextMenuDocument}
              onCommitRename={props.onCommitRename}
              onCancelRename={props.onCancelRename}
            />
          );
        })}
      </div>
    </div>
  );
}
