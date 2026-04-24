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
  const activeFolderId = activeDocument ? documentsById.get(activeDocument.id)?.folderId ?? "" : "";
  const syncLabel = pendingWrites > 0 ? "Saving..." : "Saved";

  return (
    <header className="title-bar">
      <div className="title-bar__identity">
        <div className="title-bar__brand">Evernear</div>
      </div>

      <div className="title-bar__actions">
        <div className="title-bar__group title-bar__group--project">
          <select
            aria-label="Project"
            className="title-bar__select"
            value={workspace?.layout.activeProjectId ?? ""}
            onChange={(event) => onProjectSwitch(event.target.value)}
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>
          <button className="title-bar__command" onClick={onCreateProject} type="button">
            New Project
          </button>
        </div>

        <div className="title-bar__group title-bar__group--document">
          <input
            aria-label="Document title"
            className="title-bar__input"
            disabled={documentActionDisabled}
            value={documentTitleDraft}
            onChange={(event) => onDocumentTitleDraftChange(event.target.value)}
            onBlur={() => onSaveDocumentMeta()}
            placeholder="No document"
          />
          <select
            aria-label="Folder"
            className="title-bar__select title-bar__select--folder"
            disabled={documentActionDisabled}
            value={activeFolderId}
            onChange={(event) => onSaveDocumentMeta(event.target.value || null)}
          >
            <option value="">Project Root</option>
            {(workspace?.folders ?? []).map((folder) => (
              <option key={folder.id} value={folder.id}>{folder.title}</option>
            ))}
          </select>
          <div className="title-bar__summary" aria-label="Document summary">
            <SummaryItem label="Words" value={formatCount(metrics?.wordCount ?? 0)} />
            <SummaryItem label="Paras" value={formatCount(metrics?.paragraphCount ?? 0)} />
            <SummaryItem label="Chars" value={formatCount(metrics?.characterCount ?? 0)} />
            {DEBUG_PANELS ? (
              <SummaryItem label="Storage" value={status?.storageEngine ?? "better-sqlite3"} />
            ) : null}
            <SummaryItem label="Sync" value={syncLabel} />
          </div>
        </div>

        <div className="title-bar__group title-bar__group--commands" aria-label="Text formatting">
          <button
            aria-label="Bold"
            className="title-bar__command title-bar__command--strong"
            disabled={documentActionDisabled}
            onClick={onToggleBold}
            title="Bold"
            type="button"
          >
            B
          </button>
          <button
            aria-label="Italic"
            className="title-bar__command title-bar__command--strong title-bar__command--italic"
            disabled={documentActionDisabled}
            onClick={onToggleItalic}
            title="Italic"
            type="button"
          >
            I
          </button>
          <button className="title-bar__command" disabled={documentActionDisabled} onClick={onUndo} type="button">
            Undo
          </button>
          <button className="title-bar__command" disabled={documentActionDisabled} onClick={onRedo} type="button">
            Redo
          </button>
        </div>

        <div className="title-bar__group title-bar__group--commands" aria-label="Document actions">
          <button
            className="title-bar__command"
            disabled={documentActionDisabled}
            onClick={() => onReorderDocument("up")}
            type="button"
          >
            Move Up
          </button>
          <button
            className="title-bar__command"
            disabled={documentActionDisabled}
            onClick={() => onReorderDocument("down")}
            type="button"
          >
            Move Down
          </button>
          <button className="title-bar__command" disabled={documentActionDisabled} onClick={onDeleteDocument} type="button">
            Delete Doc
          </button>
        </div>

        <div className="title-bar__group title-bar__group--commands" aria-label="Workspace view actions">
          <button className="title-bar__command" onClick={onToggleHighlights} type="button">
            {workspace?.layout.highlightsEnabled ? "Mute Highlights" : "Show Highlights"}
          </button>
          <button className="title-bar__command" onClick={onTogglePanel} type="button">
            {workspace?.layout.panelOpen ? "Hide Panel" : "Show Panel"}
          </button>
          <button className="title-bar__command" disabled={documentActionDisabled} onClick={onToggleFullScreen} type="button">
            {fullScreen ? "Exit Full Screen" : "Full Screen"}
          </button>
        </div>

        <div className="title-bar__group title-bar__group--commands" aria-label="Selection actions">
          <button
            className="title-bar__command title-bar__command--accent"
            disabled={eversliceDisabled}
            onClick={onOpenEverslice}
            type="button"
          >
            Everslice
          </button>
          <button
            className="title-bar__command title-bar__command--accent"
            disabled={documentActionDisabled || everlinkDisabled}
            onClick={onOpenEverlinkChooser}
            type="button"
          >
            {everlinkLabel}
          </button>
        </div>

        <div className="title-bar__group title-bar__group--commands">
          <button
            aria-current={shortcutsActive ? "page" : undefined}
            className={shortcutsActive ? "title-bar__command title-bar__command--active" : "title-bar__command"}
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
    <span className="title-bar__summary-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </span>
  );
}
