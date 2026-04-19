import type { ProjectRecord, WorkspaceState } from "../../../shared/domain/workspace";

type Props = {
  workspace: WorkspaceState | null;
  onProjectSwitch: (projectId: string) => void;
  onCreateProject: () => void;
  onTogglePanel: () => void;
};

// The frameless window's drag region. Native window controls (min/max/close)
// are painted by Electron's titleBarOverlay on the right edge — we just need
// to keep our interactive controls outside the drag zone via `--no-drag`.
export function TitleBar({ workspace, onProjectSwitch, onCreateProject, onTogglePanel }: Props) {
  const projects: ProjectRecord[] = workspace?.projects ?? [];
  return (
    <header className="title-bar">
      <div className="title-bar__brand">Evernear</div>
      <div className="title-bar__actions">
        <label className="title-bar__field">
          <span className="title-bar__field-label">Project</span>
          <select
            className="select-input title-bar__select"
            value={workspace?.layout.activeProjectId ?? ""}
            onChange={(event) => onProjectSwitch(event.target.value)}
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>
        </label>
        <button className="ghost-button title-bar__button" onClick={onCreateProject} type="button">New Project</button>
        <button className="ghost-button title-bar__button" onClick={onTogglePanel} type="button">
          {workspace?.layout.panelOpen ? "Hide Panel" : "Show Panel"}
        </button>
      </div>
    </header>
  );
}
