import type { EntityRecord, WorkspaceState } from "../../../shared/domain/workspace";

type Props = {
  workspace: WorkspaceState | null;
  selectedEntity: EntityRecord | null;
  onSelectEntity: (entityId: string) => void;
  onCreateManualEntity: () => void;
};

export function EntityList({ workspace, selectedEntity, onSelectEntity, onCreateManualEntity }: Props) {
  const entities = workspace?.entities ?? [];
  return (
    <section className="panel-section">
      <p className="section-kicker">Entities</p>
      <h2>Entity Library</h2>
      <div className="entity-list">
        {entities.length === 0 ? (
          <div className="stack-list">
            <p className="empty-state">
              Start from a story selection with Everlink it!, or create the first entity manually here.
            </p>
            <button className="ghost-button" onClick={onCreateManualEntity} type="button">Create First Entity</button>
          </div>
        ) : (
          entities.map((entity) => (
            <button
              key={entity.id}
              className={entity.id === selectedEntity?.id ? "entity-chip entity-chip--active" : "entity-chip"}
              onClick={() => onSelectEntity(entity.id)}
              type="button"
            >
              {entity.name}
            </button>
          ))
        )}
      </div>
      {entities.length > 0 ? (
        <button className="ghost-button" onClick={onCreateManualEntity} type="button">New Entity</button>
      ) : null}
    </section>
  );
}
