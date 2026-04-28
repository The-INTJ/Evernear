import type { EntityRecord, WorkspaceState } from "../../../shared/domain/workspace";
import { Button, PanelSection } from "../../ui";
import styles from "./EntityPanels.module.css";

type Props = {
  workspace: WorkspaceState | null;
  selectedEntity: EntityRecord | null;
  onSelectEntity: (entityId: string) => void;
  onCreateManualEntity: () => void;
};

export function EntityList({
  workspace,
  selectedEntity,
  onSelectEntity,
  onCreateManualEntity,
}: Props) {
  const entities = workspace?.entities ?? [];
  return (
    <PanelSection>
      <h2>Entity Library</h2>
      <div className={styles.entityList}>
        {entities.length === 0 ? (
          <div className={styles.list}>
            <p className={styles.empty}>
              Start from a story selection with Everlink it!, or create the first entity manually
              here.
            </p>
            <Button onClick={onCreateManualEntity}>Create First Entity</Button>
          </div>
        ) : (
          entities.map((entity) => (
            <Button
              key={entity.id}
              variant="chip"
              active={entity.id === selectedEntity?.id}
              onClick={() => onSelectEntity(entity.id)}
            >
              {entity.name}
            </Button>
          ))
        )}
      </div>
      {entities.length > 0 ? <Button onClick={onCreateManualEntity}>New Entity</Button> : null}
    </PanelSection>
  );
}
