// Entity IPC wrappers: create an entity from selected text, save the entity
// dialog (name plus rule list), delete an entity.

import { useCallback } from "react";

import type { MatchingRuleInput, ProjectRecord } from "../../shared/domain/workspace";
import { patternFromText } from "../../shared/matchingPatterns";
import type { WorkspaceHook } from "./useWorkspace";

type UseEntityActionsInput = {
  workspaceHook: WorkspaceHook;
  activeProject: ProjectRecord | null;
};

export type EntityActions = {
  createEntityFromText: (text: string) => void;
  saveEntity: (entityId: string, name: string, rules: MatchingRuleInput[]) => Promise<boolean>;
  deleteEntity: (entityId: string) => void;
};

export function useEntityActions(input: UseEntityActionsInput): EntityActions {
  const { workspaceHook: { runMutation, workspaceRef }, activeProject } = input;

  const createEntityFromText = useCallback((text: string) => {
    const name = text.trim().replace(/\s+/g, " ");
    if (!activeProject || !name) return;
    void runMutation(() => window.evernear.createEntity({
      projectId: activeProject.id,
      name,
      rules: [{ pattern: patternFromText(name), enabled: true }],
    }));
  }, [runMutation, activeProject]);

  const saveEntity = useCallback(async (entityId: string, name: string, rules: MatchingRuleInput[]) => {
    const current = workspaceRef.current?.entities.find((entity) => entity.id === entityId);
    if (!current) return false;
    const trimmedName = name.trim();

    let saved = false;
    await runMutation(async () => {
      if (trimmedName && trimmedName !== current.name) {
        await window.evernear.updateEntity({ entityId, name: trimmedName });
      }
      const next = await window.evernear.setEntityRules({ entityId, rules });
      saved = true;
      return next;
    });
    return saved;
  }, [runMutation, workspaceRef]);

  const deleteEntity = useCallback((entityId: string) => {
    void runMutation(() => window.evernear.deleteEntity({ entityId }));
  }, [runMutation]);

  return { createEntityFromText, saveEntity, deleteEntity };
}
