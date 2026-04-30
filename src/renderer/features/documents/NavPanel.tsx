import type { StoredDocumentSnapshot } from "../../../shared/domain/document";
import type {
  DocumentFolderRecord,
  DocumentSummary,
  WorkspaceState,
} from "../../../shared/domain/workspace";
import { Button, PanelSection, SelectInput, TextInput } from "../../ui";
import { NavTree } from "./nav/NavTree";
import styles from "./NavPanel.module.css";

type Props = {
  workspace: WorkspaceState | null;
  activeDocument: StoredDocumentSnapshot | null;
  projectNameDraft: string;
  activeProjectId: string;
  documentsById: Map<string, DocumentSummary>;
  onProjectNameChange: (value: string) => void;
  onSaveProjectName: () => void;
  onProjectSwitch: (projectId: string) => void;
  onCreateProject: () => void;
  onCreateFolder: (parentFolderId?: string | null, titleOverride?: string) => void;
  onCreateDocument: (
    folderId: string | null,
    openInPanel?: boolean,
    titleOverride?: string,
  ) => void;
  onToggleFolder: (folderId: string) => void;
  onRenameFolder: (folder: DocumentFolderRecord, title: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onMoveFolder: (folderId: string, newParentFolderId: string | null, beforeFolderId: string | null) => void;
  onRenameDocument: (document: DocumentSummary, title: string) => void;
  onDeleteDocument: (documentId: string, title: string) => void;
  onMoveDocument: (documentId: string, newFolderId: string | null, beforeDocumentId: string | null) => void;
  onOpenDocument: (documentId: string) => void;
};

export function NavPanel(props: Props) {
  const {
    workspace,
    activeDocument,
    projectNameDraft,
    activeProjectId,
    documentsById,
    onProjectNameChange,
    onSaveProjectName,
    onProjectSwitch,
    onCreateProject,
    onCreateFolder,
    onCreateDocument,
    onToggleFolder,
    onRenameFolder,
    onDeleteFolder,
    onMoveFolder,
    onRenameDocument,
    onDeleteDocument,
    onMoveDocument,
    onOpenDocument,
  } = props;

  const activeFolderId = activeDocument
    ? (documentsById.get(activeDocument.id)?.folderId ?? null)
    : null;

  return (
    <aside className={styles.navPanel}>
      <PanelSection project kicker="Project">
        <TextInput
          variant="project"
          value={projectNameDraft}
          onChange={(event) => onProjectNameChange(event.target.value)}
          onBlur={onSaveProjectName}
          placeholder="Project name"
        />
        <div className={styles.projectControls}>
          <SelectInput
            aria-label="Switch project"
            variant="compact"
            value={activeProjectId}
            onChange={(event) => onProjectSwitch(event.target.value)}
          >
            {(workspace?.projects ?? []).map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </SelectInput>
          <Button size="compact" onClick={onCreateProject}>
            New
          </Button>
        </div>
      </PanelSection>

      <PanelSection grow kicker="Explorer" className={styles.navTreeSection}>
        <NavTree
          workspace={workspace}
          activeDocument={activeDocument}
          onCreateFolder={(parentFolderId) => onCreateFolder(parentFolderId)}
          onCreateDocument={(folderId) => onCreateDocument(folderId, false)}
          onOpenDocument={onOpenDocument}
          onToggleFolder={onToggleFolder}
          onRenameFolder={onRenameFolder}
          onRenameDocument={onRenameDocument}
          onDeleteFolder={onDeleteFolder}
          onDeleteDocument={onDeleteDocument}
          onMoveFolder={onMoveFolder}
          onMoveDocument={onMoveDocument}
        />
      </PanelSection>

      <div className={styles.navFoot}>
        <Button size="compact" onClick={() => onCreateFolder(null)}>
          + Folder
        </Button>
        <Button size="compact" onClick={() => onCreateDocument(activeFolderId, false)}>
          + Document
        </Button>
      </div>
    </aside>
  );
}
