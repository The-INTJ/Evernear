// Project-aggregate IPC wrappers: switchProject, createProject,
// saveProjectName. Split out of useWorkspaceActions so each aggregate
// owns its own dispatch table; useWorkspaceActions now just composes
// the four per-aggregate hooks.

import { useCallback } from "react";

import type { ProjectRecord, WorkspaceState } from "../../shared/domain/workspace";
import type { WorkspaceHook } from "./useWorkspace";

type UseProjectActionsInput = {
  workspaceHook: WorkspaceHook;
  activeProject: ProjectRecord | null;
  projectNameDraft: string;
};

export type ProjectActions = {
  switchProject: (projectId: string) => void;
  createProject: () => void;
  saveProjectName: () => void;
};

export function useProjectActions(input: UseProjectActionsInput): ProjectActions {
  const { workspaceHook: { runMutation, workspaceRef }, activeProject, projectNameDraft } = input;
  const currentWorkspace = (): WorkspaceState | null => workspaceRef.current;

  const switchProject = useCallback((projectId: string) => {
    const ws = currentWorkspace();
    if (!projectId || projectId === ws?.layout.activeProjectId) return;
    void runMutation(() => window.evernear.openProject({ projectId }), "Opened the selected project.");
  }, [runMutation, workspaceRef]);

  const createProject = useCallback(() => {
    const ws = currentWorkspace();
    const nextIndex = (ws?.projects.length ?? 0) + 1;
    void runMutation(
      () => window.evernear.createProject({ name: `Untitled Project ${nextIndex}` }),
      "Created a fresh local project.",
    );
  }, [runMutation, workspaceRef]);

  const saveProjectName = useCallback(() => {
    if (!activeProject || projectNameDraft.trim() === activeProject.name) return;
    void runMutation(
      () => window.evernear.updateProject({ projectId: activeProject.id, name: projectNameDraft }),
      "Updated the project name.",
    );
  }, [runMutation, activeProject, projectNameDraft]);

  return { switchProject, createProject, saveProjectName };
}
