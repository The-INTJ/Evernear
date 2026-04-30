import type { DocumentSummary } from "../../../shared/domain/workspace";
import type { PendingSlicePlacement } from "../../state/sessionTypes";
import { truncate } from "../../utils/formatting";
import { Button, PanelSection } from "../../ui";
import styles from "./PaneContent.module.css";

type Props = {
  placement: PendingSlicePlacement;
  documentsById: Map<string, DocumentSummary>;
  onCommit: () => void;
  onCancel: () => void;
};

export function SlicePlacementPanel({ placement, documentsById, onCommit, onCancel }: Props) {
  const targetTitle = documentsById.get(placement.targetDocumentId)?.title ?? "Current document";

  return (
    <PanelSection grow>
      <div className={styles.placeCard}>
        <div className={styles.placeHead}>
          <span className={styles.placePulse} aria-hidden="true" />
          <strong>Place slice</strong>
        </div>
        <div className={styles.placeMeta}>Pending · {targetTitle}</div>
        <p className={styles.placeExcerpt}>{truncate(placement.sourceText, 180)}</p>
        <div className={styles.actions}>
          <Button variant="primary" size="compact" onClick={onCommit}>
            Commit Slice
          </Button>
          <Button variant="secondary" size="compact" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </PanelSection>
  );
}
