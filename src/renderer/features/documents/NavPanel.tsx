import { useEffect, useState } from "react";
import type { CSSProperties, MouseEvent, ReactNode } from "react";

import type { StoredDocumentSnapshot } from "../../../shared/domain/document";
import type {
  DocumentFolderRecord,
  DocumentSummary,
  WorkspaceState,
} from "../../../shared/domain/workspace";
import { Menu, MenuItem, PanelSection, TextInput, classNames } from "../../ui";
import styles from "./NavPanel.module.css";

type NavContextMenu = {
  x: number;
  y: number;
  folderId: string | null;
  folder: DocumentFolderRecord | null;
};

type Props = {
  workspace: WorkspaceState | null;
  activeDocument: StoredDocumentSnapshot | null;
  projectNameDraft: string;
  documentsByFolder: Map<string | null, DocumentSummary[]>;
  documentsById: Map<string, DocumentSummary>;
  onProjectNameChange: (value: string) => void;
  onSaveProjectName: () => void;
  onCreateFolder: (titleOverride?: string) => void;
  onCreateDocument: (
    folderId: string | null,
    openInPanel?: boolean,
    titleOverride?: string,
  ) => void;
  onToggleFolder: (folderId: string) => void;
  onRenameFolder: (folder: DocumentFolderRecord, title: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onOpenDocument: (documentId: string) => void;
};

export function NavPanel(props: Props) {
  const {
    workspace,
    activeDocument,
    projectNameDraft,
    documentsByFolder,
    documentsById,
    onProjectNameChange,
    onSaveProjectName,
    onCreateFolder,
    onCreateDocument,
    onToggleFolder,
    onRenameFolder,
    onDeleteFolder,
    onOpenDocument,
  } = props;

  const [contextMenu, setContextMenu] = useState<NavContextMenu | null>(null);
  const rootDocuments = documentsByFolder.get(null) ?? [];
  const activeFolderId = activeDocument
    ? (documentsById.get(activeDocument.id)?.folderId ?? null)
    : null;

  useEffect(() => {
    if (!contextMenu) return;

    const closeMenu = () => setContextMenu(null);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };

    window.addEventListener("pointerdown", closeMenu);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", closeMenu);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [contextMenu]);

  const openContextMenu = (
    event: MouseEvent<HTMLElement>,
    folderId: string | null,
    folder: DocumentFolderRecord | null = null,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      folderId,
      folder,
    });
  };

  const createFolderFromMenu = () => {
    setContextMenu(null);
    onCreateFolder();
  };

  const createDocumentFromMenu = (folderId: string | null) => {
    setContextMenu(null);
    onCreateDocument(folderId, false);
  };

  const renameFolderFromMenu = (folder: DocumentFolderRecord) => {
    const title = promptForTitle("Folder name", folder.title);
    setContextMenu(null);
    if (title === null || title.trim() === "") return;
    onRenameFolder(folder, title);
  };

  return (
    <aside
      className={styles.navPanel}
      onContextMenu={(event) => openContextMenu(event, activeFolderId)}
    >
      <PanelSection project kicker="Project">
        <TextInput
          variant="project"
          value={projectNameDraft}
          onChange={(event) => onProjectNameChange(event.target.value)}
          onBlur={onSaveProjectName}
          placeholder="Project name"
        />
      </PanelSection>

      <PanelSection grow kicker="Explorer" className={styles.navTreeSection}>
        <div className={styles.treeList}>
          {(workspace?.folders ?? []).map((folder) => {
            const expanded = workspace?.layout.expandedFolderIds.includes(folder.id) ?? false;
            const folderDocuments = documentsByFolder.get(folder.id) ?? [];
            return (
              <div key={folder.id} className={styles.treeFolder}>
                <button
                  className={classNames(
                    styles.treeFolderRow,
                    expanded && styles.treeFolderRowExpanded,
                  )}
                  onClick={() => onToggleFolder(folder.id)}
                  onContextMenu={(event) => openContextMenu(event, folder.id, folder)}
                  type="button"
                >
                  <span className={styles.treeDisclosure} aria-hidden="true" />
                  <span className={styles.treeFolderIcon} aria-hidden="true" />
                  <span className={styles.treeFolderName}>{folder.title}</span>
                </button>

                {expanded ? (
                  <div className={styles.treeDocuments}>
                    {folderDocuments.map((document) => (
                      <DocumentRow
                        key={document.id}
                        document={document}
                        active={document.id === activeDocument?.id}
                        onOpenDocument={onOpenDocument}
                        onContextMenu={(event) => openContextMenu(event, document.folderId)}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}

          <div
            className={styles.treeFolder}
            onContextMenu={(event) => openContextMenu(event, null)}
          >
            <div className={classNames(styles.treeFolderRow, styles.treeFolderRowStatic)}>
              <span
                className={classNames(styles.treeDisclosure, styles.treeDisclosureEmpty)}
                aria-hidden="true"
              />
              <span className={styles.treeFolderIcon} aria-hidden="true" />
              <span className={styles.treeFolderName}>Project Root</span>
            </div>
            <div className={styles.treeDocuments}>
              {rootDocuments.map((document) => (
                <DocumentRow
                  key={document.id}
                  document={document}
                  active={document.id === activeDocument?.id}
                  onOpenDocument={onOpenDocument}
                  onContextMenu={(event) => openContextMenu(event, null)}
                />
              ))}
            </div>
          </div>
        </div>
      </PanelSection>

      {contextMenu ? (
        <Menu
          style={contextMenuStyle(contextMenu)}
          onContextMenu={(event) => event.preventDefault()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <ContextMenuButton onSelect={createFolderFromMenu}>New Folder</ContextMenuButton>
          <ContextMenuButton onSelect={() => createDocumentFromMenu(contextMenu.folderId)}>
            New Document
          </ContextMenuButton>
          {contextMenu.folder ? (
            <>
              <ContextMenuButton onSelect={() => renameFolderFromMenu(contextMenu.folder!)}>
                Rename Folder
              </ContextMenuButton>
              <ContextMenuButton
                danger
                onSelect={() => {
                  onDeleteFolder(contextMenu.folder!.id);
                  setContextMenu(null);
                }}
              >
                Delete Folder
              </ContextMenuButton>
            </>
          ) : null}
        </Menu>
      ) : null}
    </aside>
  );
}

function ContextMenuButton({
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
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
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

function DocumentRow({
  document,
  active,
  onOpenDocument,
  onContextMenu,
}: {
  document: DocumentSummary;
  active: boolean;
  onOpenDocument: (documentId: string) => void;
  onContextMenu: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      className={classNames(styles.treeDocument, active && styles.treeDocumentActive)}
      onClick={() => onOpenDocument(document.id)}
      onContextMenu={onContextMenu}
      type="button"
    >
      <span className={styles.treeDocumentIcon} aria-hidden="true" />
      <span className={styles.treeDocumentTitle}>{document.title}</span>
    </button>
  );
}

function promptForTitle(label: string, defaultValue: string): string | null {
  const title = window.prompt(label, defaultValue);
  return title === null ? null : title.trim();
}

function contextMenuStyle(menu: NavContextMenu): CSSProperties {
  return {
    left: Math.max(8, Math.min(menu.x, window.innerWidth - 190)),
    top: Math.max(8, Math.min(menu.y, window.innerHeight - 180)),
  };
}
