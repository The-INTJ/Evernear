import type { CSSProperties, ReactNode } from "react";

import type {
  DocumentFolderRecord,
  DocumentSummary,
} from "../../../../shared/domain/workspace";
import { Menu, MenuItem } from "../../../ui";

export type NavContextTarget =
  | { kind: "root" }
  | { kind: "unfiled" }
  | { kind: "folder"; folder: DocumentFolderRecord }
  | { kind: "document"; document: DocumentSummary };

type Props = {
  position: { x: number; y: number };
  target: NavContextTarget;
  onCreateFolder: (parentFolderId: string | null) => void;
  onCreateDocument: (folderId: string | null) => void;
  onRequestRenameFolder: (folder: DocumentFolderRecord) => void;
  onRequestRenameDocument: (document: DocumentSummary) => void;
  onDeleteFolder: (folderId: string) => void;
  onDeleteDocument: (documentId: string, title: string) => void;
};

export function NavContextMenu(props: Props) {
  const { position, target } = props;
  const style: CSSProperties = {
    left: Math.max(8, Math.min(position.x, window.innerWidth - 200)),
    top: Math.max(8, Math.min(position.y, window.innerHeight - 220)),
  };

  return (
    <Menu
      style={style}
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {renderItems(props, target)}
    </Menu>
  );
}

function renderItems(props: Props, target: NavContextTarget): ReactNode {
  switch (target.kind) {
    case "folder": {
      const folder = target.folder;
      return (
        <>
          <Item onSelect={() => props.onCreateFolder(folder.id)}>New Subfolder</Item>
          <Item onSelect={() => props.onCreateDocument(folder.id)}>New Document</Item>
          <Item onSelect={() => props.onRequestRenameFolder(folder)}>Rename Folder</Item>
          <Item danger onSelect={() => props.onDeleteFolder(folder.id)}>
            Delete Folder
          </Item>
        </>
      );
    }
    case "document": {
      const document = target.document;
      return (
        <>
          <Item onSelect={() => props.onCreateDocument(document.folderId)}>
            New Document
          </Item>
          <Item onSelect={() => props.onRequestRenameDocument(document)}>
            Rename Document
          </Item>
          <Item danger onSelect={() => props.onDeleteDocument(document.id, document.title)}>
            Delete Document
          </Item>
        </>
      );
    }
    case "unfiled":
      return (
        <>
          <Item onSelect={() => props.onCreateFolder(null)}>New Folder</Item>
          <Item onSelect={() => props.onCreateDocument(null)}>New Document</Item>
        </>
      );
    case "root":
    default:
      return (
        <>
          <Item onSelect={() => props.onCreateFolder(null)}>New Folder</Item>
          <Item onSelect={() => props.onCreateDocument(null)}>New Document</Item>
        </>
      );
  }
}

function Item({
  children,
  danger,
  onSelect,
}: {
  children: ReactNode;
  danger?: boolean;
  onSelect: () => void;
}) {
  return (
    <MenuItem
      danger={danger}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onSelect();
      }}
      type="button"
    >
      {children}
    </MenuItem>
  );
}
