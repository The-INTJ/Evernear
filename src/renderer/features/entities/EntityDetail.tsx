type Props = {
  entityNameDraft: string;
  onEntityNameDraftChange: (value: string) => void;
  onSaveEntityName: () => void;
  onDeleteEntity: () => void;
};

export function EntityDetail({
  entityNameDraft,
  onEntityNameDraftChange,
  onSaveEntityName,
  onDeleteEntity,
}: Props) {
  return (
    <section className="panel-section">
      <p className="section-kicker">Entity Detail</p>
      <input
        className="text-input"
        value={entityNameDraft}
        onChange={(event) => onEntityNameDraftChange(event.target.value)}
        onBlur={onSaveEntityName}
      />
      <div className="toolbar-actions">
        <button className="ghost-button ghost-button--danger" onClick={onDeleteEntity} type="button">
          Delete Entity
        </button>
      </div>
    </section>
  );
}
