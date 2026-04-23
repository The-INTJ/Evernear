import type { ProjectRecord, WorkspaceState } from "../../../shared/domain/workspace";

type Props = {
  workspace: WorkspaceState | null;
  hasActiveDocument: boolean;
  everlinkLabel: string;
  everlinkDisabled: boolean;
  eversliceDisabled: boolean;
  fullScreen: boolean;
  shortcutsActive: boolean;
  onProjectSwitch: (projectId: string) => void;
  onCreateProject: () => void;
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
// are painted by Electron's titleBarOverlay on the right edge — we just need
// to keep our interactive controls outside the drag zone via `--no-drag`.
export function TitleBar({
  workspace,
  hasActiveDocument,
  everlinkLabel,
  everlinkDisabled,
  eversliceDisabled,
  fullScreen,
  shortcutsActive,
  onProjectSwitch,
  onCreateProject,
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
  const documentActionDisabled = !hasActiveDocument;
  return (
    <header className="title-bar">
      <div className="title-bar__identity">
        <div className="title-bar__brand">Evernear</div>
        <div className="title-bar__tagline">Local writing workspace</div>
      </div>
      <div className="title-bar__actions">
        <div className="title-bar__group title-bar__group--project">
          <label className="title-bar__field">
            <span className="title-bar__field-label">Project</span>
            <select
              className="title-bar__select"
              value={workspace?.layout.activeProjectId ?? ""}
              onChange={(event) => onProjectSwitch(event.target.value)}
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </label>
          <button className="title-bar__command" onClick={onCreateProject} type="button">
            New Project
          </button>
        </div>

        <div className="title-bar__group" aria-label="Text formatting">
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

        <div className="title-bar__group" aria-label="Document actions">
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

        <div className="title-bar__group" aria-label="Workspace view actions">
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

        <div className="title-bar__group" aria-label="Selection actions">
          <button
            className="title-bar__command title-bar__command--primary"
            disabled={eversliceDisabled}
            onClick={onOpenEverslice}
            type="button"
          >
            Everslice
          </button>
          <button
            className="title-bar__command title-bar__command--primary"
            disabled={documentActionDisabled || everlinkDisabled}
            onClick={onOpenEverlinkChooser}
            type="button"
          >
            {everlinkLabel}
          </button>
        </div>

        <div className="title-bar__group">
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
