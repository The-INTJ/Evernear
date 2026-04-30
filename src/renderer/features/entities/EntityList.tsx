import type { EntityRecord, WorkspaceState } from "../../../shared/domain/workspace";
import { Button, PanelSection, Swatch } from "../../ui";
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
  const sliceCounts = new Map<string, number>();
  for (const link of workspace?.entitySlices ?? []) {
    sliceCounts.set(link.entityId, (sliceCounts.get(link.entityId) ?? 0) + 1);
  }

  return (
    <PanelSection className={styles.entityLibrary}>
      <div className={styles.panelTabs} aria-label="Entity panel context">
        <span className={styles.panelTab}>
          Entities <span className={styles.count}>{entities.length}</span>
        </span>
        {selectedEntity ? (
          <span className={styles.panelTabActive}>{selectedEntity.name}</span>
        ) : null}
        <span className={styles.panelTab}>
          Slices <span className={styles.count}>{workspace?.slices.length ?? 0}</span>
        </span>
      </div>
      <div className={styles.entityList}>
        {entities.length === 0 ? (
          <div className={styles.list}>
            <p className={styles.empty}>
              Start from a story selection with Everlink it!, or create the first entity manually
              here.
            </p>
            <Button size="compact" onClick={onCreateManualEntity}>
              Create First Entity
            </Button>
          </div>
        ) : (
          entities.map((entity, index) => (
            <Button
              key={entity.id}
              variant="chip"
              size="compact"
              active={entity.id === selectedEntity?.id}
              onClick={() => onSelectEntity(entity.id)}
            >
              <Swatch index={index} />
              {entity.name}
              <span className={styles.count}>{sliceCounts.get(entity.id) ?? 0}</span>
            </Button>
          ))
        )}
        {entities.length > 0 ? (
          <Button variant="chip" size="compact" onClick={onCreateManualEntity}>
            + New
          </Button>
        ) : null}
      </div>
    </PanelSection>
  );
}
