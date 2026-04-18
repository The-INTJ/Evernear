import type { StoredDocumentSnapshot } from "../../../shared/domain/document";
import type {
  DocumentFolderRecord,
  DocumentSummary,
  WorkspaceState,
} from "../../../shared/domain/workspace";
import { formatCount } from "../../utils/formatting";

type Props = {
  workspace: WorkspaceState | null;
  activeDocument: StoredDocumentSnapshot | null;
  projectNameDraft: string;
  newFolderTitle: string;
  newDocumentTitle: string;
  documentsByFolder: Map<string | null, DocumentSummary[]>;
  documentsById: Map<string, DocumentSummary>;
  onProjectNameChange: (value: string) => void;
  onSaveProjectName: () => void;
  onNewFolderTitleChange: (value: string) => void;
  onCreateFolder: () => void;
  onNewDocumentTitleChange: (value: string) => void;
  onCreateDocument: (folderId: string | null) => void;
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
    newFolderTitle,
    newDocumentTitle,
    documentsByFolder,
    documentsById,
    onProjectNameChange,
    onSaveProjectName,
    onNewFolderTitleChange,
    onCreateFolder,
    onNewDocumentTitleChange,
    onCreateDocument,
    onToggleFolder,
    onRenameFolder,
    onDeleteFolder,
    onOpenDocument,
  } = props;

  const rootDocuments = documentsByFolder.get(null) ?? [];

  return (
    <aside className="nav-panel">
      <section className="panel-section">
        <p className="section-kicker">Project</p>
        <input
          className="text-input"
          value={projectNameDraft}
          onChange={(event) => onProjectNameChange(event.target.value)}
          onBlur={onSaveProjectName}
          placeholder="Project name"
        />
        <div className="toolbar-actions">
          <input
            className="text-input"
            value={newFolderTitle}
            onChange={(event) => onNewFolderTitleChange(event.target.value)}
            placeholder="New folder"
          />
          <button className="ghost-button" onClick={onCreateFolder} type="button">Add Folder</button>
        </div>
        <div className="toolbar-actions">
          <input
            className="text-input"
            value={newDocumentTitle}
            onChange={(event) => onNewDocumentTitleChange(event.target.value)}
            placeholder="New document"
          />
          <button
            className="ghost-button"
            onClick={() => {
              const folderId = activeDocument
                ? documentsById.get(activeDocument.id)?.folderId ?? null
                : null;
              onCreateDocument(folderId);
            }}
            type="button"
          >
            Add Doc
          </button>
        </div>
      </section>

      <section className="panel-section">
        <p className="section-kicker">Documents</p>
        <div className="tree-list">
          {(workspace?.folders ?? []).map((folder) => {
            const expanded = workspace?.layout.expandedFolderIds.includes(folder.id) ?? false;
            const folderDocuments = documentsByFolder.get(folder.id) ?? [];
            return (
              <article key={folder.id} className="tree-folder">
                <div className="tree-folder__header">
                  <button
                    className="tree-toggle"
                    onClick={() => onToggleFolder(folder.id)}
                    type="button"
                  >
                    {expanded ? "−" : "+"}
                  </button>
                  <input
                    className="tree-folder__input"
                    defaultValue={folder.title}
                    onBlur={(event) => onRenameFolder(folder, event.target.value)}
                  />
                  <button
                    className="tree-inline-button"
                    onClick={() => onCreateDocument(folder.id)}
                    type="button"
                  >
                    + Doc
                  </button>
                  <button
                    className="tree-inline-button tree-inline-button--danger"
                    onClick={() => onDeleteFolder(folder.id)}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
                {expanded ? (
                  <div className="tree-documents">
                    {folderDocuments.length === 0 ? (
                      <p className="empty-state">No documents here yet.</p>
                    ) : folderDocuments.map((document) => (
                      <button
                        key={document.id}
                        className={document.id === activeDocument?.id ? "tree-document tree-document--active" : "tree-document"}
                        onClick={() => onOpenDocument(document.id)}
                        type="button"
                      >
                        <span>{document.title}</span>
                        <small>{formatCount(document.wordCount)} words</small>
                      </button>
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })}

          {rootDocuments.length > 0 ? (
            <article className="tree-folder">
              <div className="tree-folder__header tree-folder__header--static">
                <strong>Loose Documents</strong>
              </div>
              <div className="tree-documents">
                {rootDocuments.map((document) => (
                  <button
                    key={document.id}
                    className={document.id === activeDocument?.id ? "tree-document tree-document--active" : "tree-document"}
                    onClick={() => onOpenDocument(document.id)}
                    type="button"
                  >
                    <span>{document.title}</span>
                    <small>{formatCount(document.wordCount)} words</small>
                  </button>
                ))}
              </div>
            </article>
          ) : null}
        </div>
      </section>
    </aside>
  );
}
