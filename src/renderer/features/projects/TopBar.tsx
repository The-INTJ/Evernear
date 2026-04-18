import type { ProjectRecord, WorkspaceState } from "../../../shared/domain/workspace";

type Props = {
  workspace: WorkspaceState | null;
  onProjectSwitch: (projectId: string) => void;
  onCreateProject: () => void;
  onTogglePanel: () => void;
};

export function TopBar({ workspace, onProjectSwitch, onCreateProject, onTogglePanel }: Props) {
  const projects: ProjectRecord[] = workspace?.projects ?? [];
  return (
    <header className="mvp-topbar">
      <div className="brand-block">
        <span className="eyebrow">Evernear MVP</span>
        <h1>Writing Workspace</h1>
        <p className="toolbar-note">
          Local-first folders, generic documents, entity-aware highlights, and slice authoring in a persistent panel.
        </p>
      </div>
      <div className="topbar-actions">
        <label className="field-stack field-stack--compact">
          <span className="field-label">Project</span>
          <select
            className="select-input"
            value={workspace?.layout.activeProjectId ?? ""}
            onChange={(event) => onProjectSwitch(event.target.value)}
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>
        </label>
        <button className="secondary-button" onClick={onCreateProject} type="button">New Project</button>
        <button className="secondary-button" onClick={onTogglePanel} type="button">
          {workspace?.layout.panelOpen ? "Hide Panel" : "Show Panel"}
        </button>
      </div>
    </header>
  );
}
