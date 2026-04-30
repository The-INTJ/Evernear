import type { StoredDocumentSnapshot } from "../../../shared/domain/document";
import type { WorkspaceState } from "../../../shared/domain/workspace";
import { classNames } from "../../ui";
import styles from "./TitleBar.module.css";

type Props = {
  workspace: WorkspaceState | null;
  activeDocument: StoredDocumentSnapshot | null;
  documentTitleDraft: string;
  fullScreen: boolean;
  shortcutsActive: boolean;
  onDocumentTitleDraftChange: (value: string) => void;
  onSaveDocumentMeta: (folderId?: string | null) => void;
  onTogglePanel: () => void;
  onToggleHighlights: () => void;
  onToggleFullScreen: () => void;
  onOpenShortcuts: () => void;
};

// The frameless window's drag region. Native window controls (min/max/close)
// are painted by Electron's titleBarOverlay on the right edge, so every
// interactive control opts out of dragging.
export function TitleBar({
  workspace,
  activeDocument,
  documentTitleDraft,
  fullScreen,
  shortcutsActive,
  onDocumentTitleDraftChange,
  onSaveDocumentMeta,
  onTogglePanel,
  onToggleHighlights,
  onToggleFullScreen,
  onOpenShortcuts,
}: Props) {
  const documentActionDisabled = activeDocument === null;
  const activeProject = workspace?.projects.find(
    (project) => project.id === workspace.layout.activeProjectId,
  );
  const activeDocumentSummary = workspace?.documents.find(
    (document) => document.id === activeDocument?.id,
  );
  const activeFolder = workspace?.folders.find(
    (folder) => folder.id === activeDocumentSummary?.folderId,
  );

  return (
    <header className={styles.titleBar}>
      <div className={styles.brand}>
        <span className={styles.brandMark} aria-hidden="true" />
        <span>Evernear</span>
      </div>

      <div className={styles.documentTrail} aria-label="Document location">
        <span className={styles.crumb}>{activeProject?.name ?? "No project"}</span>
        <span className={styles.separator}>/</span>
        <span className={styles.crumb}>{activeFolder?.title ?? "Unfiled"}</span>
        <span className={styles.separator}>/</span>
        <input
          aria-label="Document title"
          className={styles.input}
          disabled={documentActionDisabled}
          value={documentTitleDraft}
          onChange={(event) => onDocumentTitleDraftChange(event.target.value)}
          onBlur={() => onSaveDocumentMeta()}
          placeholder="No document"
        />
      </div>

      <div className={styles.commands} aria-label="Workspace view actions">
        <button
          className={classNames(styles.command, workspace?.layout.highlightsEnabled && styles.on)}
          onClick={onToggleHighlights}
          title="Toggle entity highlights"
          type="button"
        >
          {workspace?.layout.highlightsEnabled ? "Highlights On" : "Highlights Off"}
          <span className={styles.kbd}>Ctrl+H</span>
        </button>
        <button className={styles.command} onClick={onTogglePanel} type="button">
          Panel
          <span className={styles.kbd}>{"Ctrl+\\"}</span>
        </button>
        <button
          className={styles.command}
          disabled={documentActionDisabled}
          onClick={onToggleFullScreen}
          type="button"
        >
          {fullScreen ? "Exit Full Screen" : "Full Screen"}
          <span className={styles.kbd}>F11</span>
        </button>
        <button
          aria-current={shortcutsActive ? "page" : undefined}
          className={classNames(styles.command, shortcutsActive && styles.on)}
          onClick={onOpenShortcuts}
          type="button"
        >
          Shortcuts
          <span className={styles.kbd}>?</span>
        </button>
      </div>
    </header>
  );
}
