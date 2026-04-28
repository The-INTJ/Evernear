import { useEffect, useState } from "react";
import type { CSSProperties, MouseEvent, ReactNode } from "react";

import type { StoredDocumentSnapshot } from "../../../shared/domain/document";
import type {
  DocumentFolderRecord,
  DocumentSummary,
  WorkspaceState,
} from "../../../shared/domain/workspace";

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
  onCreateDocument: (folderId: string | null, openInPanel?: boolean, titleOverride?: string) => void;
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
  const activeFolderId = activeDocument ? documentsById.get(activeDocument.id)?.folderId ?? null : null;

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
      className="nav-panel"
      onContextMenu={(event) => openContextMenu(event, activeFolderId)}
    >
      <section className="panel-section panel-section--project">
        <p className="section-kicker">Project</p>
        <input
          className="text-input text-input--project"
          value={projectNameDraft}
          onChange={(event) => onProjectNameChange(event.target.value)}
          onBlur={onSaveProjectName}
          placeholder="Project name"
        />
      </section>

      <section className="panel-section panel-section--grow nav-tree-section">
        <p className="section-kicker">Explorer</p>
        <div className="tree-list">
          {(workspace?.folders ?? []).map((folder) => {
            const expanded = workspace?.layout.expandedFolderIds.includes(folder.id) ?? false;
            const folderDocuments = documentsByFolder.get(folder.id) ?? [];
            return (
              <div key={folder.id} className="tree-folder">
                <button
                  className={expanded ? "tree-folder__row tree-folder__row--expanded" : "tree-folder__row"}
                  onClick={() => onToggleFolder(folder.id)}
                  onContextMenu={(event) => openContextMenu(event, folder.id, folder)}
                  type="button"
                >
                  <span className="tree-disclosure" aria-hidden="true" />
                  <span className="tree-folder__icon" aria-hidden="true" />
                  <span className="tree-folder__name">{folder.title}</span>
                </button>

                {expanded ? (
                  <div className="tree-documents">
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
            className="tree-folder tree-folder--root"
            onContextMenu={(event) => openContextMenu(event, null)}
          >
            <div className="tree-folder__row tree-folder__row--static">
              <span className="tree-disclosure tree-disclosure--empty" aria-hidden="true" />
              <span className="tree-folder__icon" aria-hidden="true" />
              <span className="tree-folder__name">Project Root</span>
            </div>
            <div className="tree-documents">
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
      </section>

      {contextMenu ? (
        <div
          className="nav-context-menu"
          style={contextMenuStyle(contextMenu)}
          onContextMenu={(event) => event.preventDefault()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <ContextMenuButton onSelect={createFolderFromMenu}>
            New Folder
          </ContextMenuButton>
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
        </div>
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
    <button
      className={danger ? "nav-context-menu__item nav-context-menu__item--danger" : "nav-context-menu__item"}
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
    </button>
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
      className={active ? "tree-document tree-document--active" : "tree-document"}
      onClick={() => onOpenDocument(document.id)}
      onContextMenu={onContextMenu}
      type="button"
    >
      <span className="tree-document__icon" aria-hidden="true" />
      <span className="tree-document__title">{document.title}</span>
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
