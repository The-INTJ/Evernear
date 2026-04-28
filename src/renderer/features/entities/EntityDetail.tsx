import { Button, PanelSection, TextInput } from "../../ui";
import styles from "./EntityPanels.module.css";

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
    <PanelSection>
      <TextInput
        value={entityNameDraft}
        onChange={(event) => onEntityNameDraftChange(event.target.value)}
        onBlur={onSaveEntityName}
      />
      <div className={styles.actions}>
        <Button tone="danger" onClick={onDeleteEntity}>
          Delete Entity
        </Button>
      </div>
    </PanelSection>
  );
}
