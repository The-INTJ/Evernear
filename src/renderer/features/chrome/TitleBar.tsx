import {
  collectDocumentMetrics,
  type StoredDocumentSnapshot,
} from "../../../shared/domain/document";
import type {
  DocumentSummary,
  ProjectRecord,
  WorkspaceState,
  WorkspaceStatus,
} from "../../../shared/domain/workspace";
import { DEBUG_PANELS } from "../../utils/devFlags";
import { formatCount } from "../../utils/formatting";
import { classNames } from "../../ui";
import styles from "./TitleBar.module.css";

type Props = {
  workspace: WorkspaceState | null;
  activeDocument: StoredDocumentSnapshot | null;
  status: WorkspaceStatus | null;
  documentTitleDraft: string;
  pendingWrites: number;
  documentsById: Map<string, DocumentSummary>;
  everlinkLabel: string;
  everlinkDisabled: boolean;
  eversliceDisabled: boolean;
  fullScreen: boolean;
  shortcutsActive: boolean;
  onProjectSwitch: (projectId: string) => void;
  onCreateProject: () => void;
  onDocumentTitleDraftChange: (value: string) => void;
  onSaveDocumentMeta: (folderId?: string | null) => void;
  onTogglePanel: () => void;
  onToggleBold: () => void;
  onToggleItalic: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onReorderDocument: (direction: "up" | "down") => void;
  onToggleHighlights: () => void;
  onToggleFullScreen: () => void;
  onOpenEverslice: () => void;
  onOpenEverlinkChooser: () => void;
  onDeleteDocument: () => void;
  onOpenShortcuts: () => void;
};

// The frameless window's drag region. Native window controls (min/max/close)
// are painted by Electron's titleBarOverlay on the right edge, so every
// interactive control opts out of dragging.
export function TitleBar({
  workspace,
  activeDocument,
  status,
  documentTitleDraft,
  pendingWrites,
  documentsById,
  everlinkLabel,
  everlinkDisabled,
  eversliceDisabled,
  fullScreen,
  shortcutsActive,
  onProjectSwitch,
  onCreateProject,
  onDocumentTitleDraftChange,
  onSaveDocumentMeta,
  onTogglePanel,
  onToggleBold,
  onToggleItalic,
  onUndo,
  onRedo,
  onReorderDocument,
  onToggleHighlights,
  onToggleFullScreen,
  onOpenEverslice,
  onOpenEverlinkChooser,
  onDeleteDocument,
  onOpenShortcuts,
}: Props) {
  const projects: ProjectRecord[] = workspace?.projects ?? [];
  const documentActionDisabled = activeDocument === null;
  const metrics = activeDocument ? collectDocumentMetrics(activeDocument.plainText) : null;
  const activeFolderId = activeDocument
    ? (documentsById.get(activeDocument.id)?.folderId ?? "")
    : "";
  const syncLabel = pendingWrites > 0 ? "Saving..." : "Saved";

  return (
    <header className={styles.titleBar}>
      <div className={styles.identity}>
        <div className={styles.brand}>Evernear</div>
      </div>

      <div className={styles.actions}>
        <div className={classNames(styles.group, styles.projectGroup)}>
          <select
            aria-label="Project"
            className={styles.select}
            value={workspace?.layout.activeProjectId ?? ""}
            onChange={(event) => onProjectSwitch(event.target.value)}
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <button className={styles.command} onClick={onCreateProject} type="button">
            New Project
          </button>
        </div>

        <div className={classNames(styles.group, styles.documentGroup)}>
          <input
            aria-label="Document title"
            className={styles.input}
            disabled={documentActionDisabled}
            value={documentTitleDraft}
            onChange={(event) => onDocumentTitleDraftChange(event.target.value)}
            onBlur={() => onSaveDocumentMeta()}
            placeholder="No document"
          />
          <select
            aria-label="Folder"
            className={classNames(styles.select, styles.folderSelect)}
            disabled={documentActionDisabled}
            value={activeFolderId}
            onChange={(event) => onSaveDocumentMeta(event.target.value || null)}
          >
            <option value="">Unfiled</option>
            {(workspace?.folders ?? []).map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.title}
              </option>
            ))}
          </select>
          <div className={styles.summary} aria-label="Document summary">
            <SummaryItem label="Words" value={formatCount(metrics?.wordCount ?? 0)} />
            <SummaryItem label="Paras" value={formatCount(metrics?.paragraphCount ?? 0)} />
            <SummaryItem label="Chars" value={formatCount(metrics?.characterCount ?? 0)} />
            {DEBUG_PANELS ? (
              <SummaryItem label="Storage" value={status?.storageEngine ?? "better-sqlite3"} />
            ) : null}
            <SummaryItem label="Sync" value={syncLabel} />
          </div>
        </div>

        <div className={styles.group} aria-label="Text formatting">
          <button
            aria-label="Bold"
            className={classNames(styles.command, styles.strongCommand)}
            disabled={documentActionDisabled}
            onClick={onToggleBold}
            title="Bold"
            type="button"
          >
            B
          </button>
          <button
            aria-label="Italic"
            className={classNames(styles.command, styles.strongCommand, styles.italicCommand)}
            disabled={documentActionDisabled}
            onClick={onToggleItalic}
            title="Italic"
            type="button"
          >
            I
          </button>
          <button
            className={styles.command}
            disabled={documentActionDisabled}
            onClick={onUndo}
            type="button"
          >
            Undo
          </button>
          <button
            className={styles.command}
            disabled={documentActionDisabled}
            onClick={onRedo}
            type="button"
          >
            Redo
          </button>
        </div>

        <div className={styles.group} aria-label="Document actions">
          <button
            className={styles.command}
            disabled={documentActionDisabled}
            onClick={() => onReorderDocument("up")}
            type="button"
          >
            Move Up
          </button>
          <button
            className={styles.command}
            disabled={documentActionDisabled}
            onClick={() => onReorderDocument("down")}
            type="button"
          >
            Move Down
          </button>
          <button
            className={styles.command}
            disabled={documentActionDisabled}
            onClick={onDeleteDocument}
            type="button"
          >
            Delete Doc
          </button>
        </div>

        <div className={styles.group} aria-label="Workspace view actions">
          <button className={styles.command} onClick={onToggleHighlights} type="button">
            {workspace?.layout.highlightsEnabled ? "Mute Highlights" : "Show Highlights"}
          </button>
          <button className={styles.command} onClick={onTogglePanel} type="button">
            {workspace?.layout.panelOpen ? "Hide Panel" : "Show Panel"}
          </button>
          <button
            className={styles.command}
            disabled={documentActionDisabled}
            onClick={onToggleFullScreen}
            type="button"
          >
            {fullScreen ? "Exit Full Screen" : "Full Screen"}
          </button>
        </div>

        <div className={styles.group} aria-label="Selection actions">
          <button
            className={classNames(styles.command, styles.accentCommand)}
            disabled={eversliceDisabled}
            onClick={onOpenEverslice}
            type="button"
          >
            Everslice
          </button>
          <button
            className={classNames(styles.command, styles.accentCommand)}
            disabled={documentActionDisabled || everlinkDisabled}
            onClick={onOpenEverlinkChooser}
            type="button"
          >
            {everlinkLabel}
          </button>
        </div>

        <div className={styles.group}>
          <button
            aria-current={shortcutsActive ? "page" : undefined}
            className={classNames(styles.command, shortcutsActive && styles.activeCommand)}
            onClick={onOpenShortcuts}
            type="button"
          >
            Shortcuts
          </button>
        </div>
      </div>
    </header>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <span className={styles.summaryItem}>
      <span>{label}</span>
      <strong>{value}</strong>
    </span>
  );
}
