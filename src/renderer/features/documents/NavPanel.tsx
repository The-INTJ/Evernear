import { useEffect, useRef, useState } from "react";
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent,
  ReactNode,
} from "react";

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
  const [renamingFolder, setRenamingFolder] = useState<{
    folderId: string;
    title: string;
  } | null>(null);
  const renameCancelledRef = useRef(false);
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
    setContextMenu(null);
    renameCancelledRef.current = false;
    setRenamingFolder({ folderId: folder.id, title: folder.title });
  };

  const updateRenameDraft = (folderId: string, title: string) => {
    setRenamingFolder((current) =>
      current?.folderId === folderId ? { ...current, title } : current,
    );
  };

  const commitRenameFolder = (folder: DocumentFolderRecord) => {
    if (renameCancelledRef.current) {
      renameCancelledRef.current = false;
      return;
    }

    if (renamingFolder?.folderId !== folder.id) return;

    const title = renamingFolder.title.trim();
    setRenamingFolder(null);
    if (title === "" || title === folder.title) return;
    onRenameFolder(folder, title);
  };

  const handleRenameKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.blur();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      renameCancelledRef.current = true;
      setRenamingFolder(null);
    }
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
            const renameDraft =
              renamingFolder?.folderId === folder.id ? renamingFolder.title : null;

            return (
              <div key={folder.id} className={styles.treeFolder}>
                {renameDraft === null ? (
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
                ) : (
                  <div
                    className={classNames(
                      styles.treeFolderRow,
                      styles.treeFolderRowEditing,
                      expanded && styles.treeFolderRowExpanded,
                    )}
                  >
                    <span className={styles.treeDisclosure} aria-hidden="true" />
                    <span className={styles.treeFolderIcon} aria-hidden="true" />
                    <input
                      aria-label="Folder name"
                      autoFocus
                      className={styles.treeFolderRenameInput}
                      onBlur={() => commitRenameFolder(folder)}
                      onChange={(event) => updateRenameDraft(folder.id, event.target.value)}
                      onKeyDown={handleRenameKeyDown}
                      value={renameDraft}
                    />
                  </div>
                )}

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

          {rootDocuments.length > 0 ? (
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
                <span className={styles.treeFolderName}>Unfiled Documents</span>
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
          ) : null}
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

function contextMenuStyle(menu: NavContextMenu): CSSProperties {
  return {
    left: Math.max(8, Math.min(menu.x, window.innerWidth - 190)),
    top: Math.max(8, Math.min(menu.y, window.innerHeight - 180)),
  };
}
