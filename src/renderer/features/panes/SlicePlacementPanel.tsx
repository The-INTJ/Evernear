import type { DocumentSummary } from "../../../shared/domain/workspace";
import type { PendingSlicePlacement } from "../../state/sessionTypes";
import { truncate } from "../../utils/formatting";
import { Button, Card, PanelSection } from "../../ui";
import styles from "./PaneContent.module.css";

type Props = {
  placement: PendingSlicePlacement;
  documentsById: Map<string, DocumentSummary>;
  onCommit: () => void;
  onCancel: () => void;
};

export function SlicePlacementPanel({ placement, documentsById, onCommit, onCancel }: Props) {
  return (
    <PanelSection grow>
      <h2>Place the slice in the target document</h2>
      <p className={styles.copy}>
        Write freely in the target document, then select the passage you want to track as a slice
        and click Commit. If you commit with an empty cursor instead, the source selection is
        inserted there and becomes the slice.
      </p>
      <Card variant="selection">
        <strong>Source text</strong>
        <span>{truncate(placement.sourceText, 140)}</span>
      </Card>
      <Card variant="selection">
        <strong>Target</strong>
        <span>{documentsById.get(placement.targetDocumentId)?.title ?? "Current document"}</span>
      </Card>
      <div className={styles.actions}>
        <Button variant="primary" onClick={onCommit}>
          Commit Slice
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </PanelSection>
  );
}
