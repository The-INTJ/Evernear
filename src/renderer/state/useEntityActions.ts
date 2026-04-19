// Entity + matching-rule IPC wrappers. These callbacks own the entity
// detail pane's mutations: select an entity, rename it, attach rules,
// toggle/delete rules, create a blank entity, delete an entity.

import { useCallback } from "react";

import type {
  MatchingRuleRecord,
  ProjectRecord,
  WorkspaceState,
} from "../../shared/domain/workspace";
import type { RuleFormState } from "./sessionTypes";
import { initialRuleForm } from "./sessionTypes";
import type { WorkspaceHook } from "./useWorkspace";

type UseEntityActionsInput = {
  workspaceHook: WorkspaceHook;
  activeProject: ProjectRecord | null;
  selectedEntity: { id: string; name: string } | null;
  entityNameDraft: string;
  ruleForm: RuleFormState;
  setRuleForm: React.Dispatch<React.SetStateAction<RuleFormState>>;
};

export type EntityActions = {
  selectEntity: (entityId: string) => void;
  saveEntityName: () => void;
  createEntityRule: () => void;
  createManualEntity: () => void;
  toggleRule: (rule: MatchingRuleRecord) => void;
  deleteRule: (ruleId: string) => void;
  deleteEntity: () => void;
};

export function useEntityActions(input: UseEntityActionsInput): EntityActions {
  const { workspaceHook: { runMutation, appendLog, workspaceRef }, activeProject, selectedEntity, entityNameDraft, ruleForm, setRuleForm } = input;
  const currentWorkspace = (): WorkspaceState | null => workspaceRef.current;

  const selectEntity = useCallback((entityId: string) => {
    void runMutation(() => window.evernear.updateLayout({
      selectedEntityId: entityId,
      panelOpen: true,
      panelMode: "entities",
    }));
  }, [runMutation]);

  const saveEntityName = useCallback(() => {
    if (!selectedEntity || entityNameDraft.trim() === selectedEntity.name) return;
    void runMutation(
      () => window.evernear.updateEntity({ entityId: selectedEntity.id, name: entityNameDraft }),
      "Updated the entity name.",
    );
  }, [runMutation, selectedEntity, entityNameDraft]);

  const createEntityRule = useCallback(() => {
    if (!selectedEntity) return;
    if (ruleForm.pattern.trim().length === 0 || ruleForm.label.trim().length === 0) {
      appendLog("Matching rules need both a label and a pattern.", "warn");
      return;
    }
    const form = ruleForm;
    setRuleForm(initialRuleForm);
    void runMutation(
      () => window.evernear.upsertMatchingRule({
        entityId: selectedEntity.id,
        label: form.label.trim(),
        kind: form.kind,
        pattern: form.pattern,
        wholeWord: form.wholeWord,
        allowPossessive: form.allowPossessive,
        enabled: form.enabled,
      }),
      `Added rule "${form.label.trim()}".`,
    );
  }, [runMutation, selectedEntity, ruleForm, setRuleForm, appendLog]);

  const createManualEntity = useCallback(() => {
    if (!activeProject) return;
    const ws = currentWorkspace();
    const nextIndex = (ws?.entities.length ?? 0) + 1;
    void runMutation(
      () => window.evernear.createEntity({ projectId: activeProject.id, name: `Entity ${nextIndex}` }),
      "Created a new empty entity.",
    );
  }, [runMutation, activeProject, workspaceRef]);

  const toggleRule = useCallback((rule: MatchingRuleRecord) => {
    void runMutation(() => window.evernear.upsertMatchingRule({
      id: rule.id,
      entityId: rule.entityId,
      label: rule.label,
      kind: rule.kind,
      pattern: rule.pattern,
      wholeWord: rule.wholeWord,
      allowPossessive: rule.allowPossessive,
      enabled: !rule.enabled,
    }));
  }, [runMutation]);

  const deleteRule = useCallback((ruleId: string) => {
    void runMutation(() => window.evernear.deleteMatchingRule({ ruleId }), "Deleted the matching rule.");
  }, [runMutation]);

  const deleteEntity = useCallback(() => {
    if (!selectedEntity) return;
    void runMutation(
      () => window.evernear.deleteEntity({ entityId: selectedEntity.id }),
      `Deleted "${selectedEntity.name}" and cleaned up orphaned slice records.`,
    );
  }, [runMutation, selectedEntity]);

  return {
    selectEntity, saveEntityName, createEntityRule, createManualEntity,
    toggleRule, deleteRule, deleteEntity,
  };
}
