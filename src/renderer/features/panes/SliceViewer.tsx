import type { EntityRecord } from "../../../shared/domain/workspace";
import type { ResolvedSliceView } from "../../utils/workspace";
import { formatBoundaryReason } from "../../utils/formatting";
import { Button, Card, PanelSection, cardStyles } from "../../ui";
import styles from "./PaneContent.module.css";

type Props = {
  selectedEntity: EntityRecord;
  entitySlices: ResolvedSliceView[];
  onOpenSliceInPanel: (documentId: string, entityId: string) => void;
  onDeleteSlice: (sliceId: string) => void;
};

export function SliceViewer({
  selectedEntity,
  entitySlices,
  onOpenSliceInPanel,
  onDeleteSlice,
}: Props) {
  return (
    <PanelSection className={styles.sliceViewer}>
      <h2>Slice Viewer</h2>
      <div className={styles.list}>
        {entitySlices.length === 0 ? (
          <p className={styles.empty}>
            No slices linked yet. Use Everlink it! to place the first one.
          </p>
        ) : (
          entitySlices.map(({ slice, boundary, document }) => (
            <Card key={slice.id} status={boundary?.resolution.status ?? "neutral"}>
              <div className={cardStyles.meta}>
                <strong>{slice.title}</strong>
                <span>{document?.title ?? "Document"}</span>
              </div>
              <p className={cardStyles.copy}>{slice.excerpt}</p>
              <p className={cardStyles.copy}>
                {boundary
                  ? formatBoundaryReason(boundary.resolution.reason)
                  : "Boundary record missing"}
              </p>
              <div className={styles.actions}>
                <Button
                  size="compact"
                  onClick={() => onOpenSliceInPanel(slice.documentId, selectedEntity.id)}
                >
                  Open in Panel
                </Button>
                <Button size="compact" tone="danger" onClick={() => onDeleteSlice(slice.id)}>
                  Delete
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>
    </PanelSection>
  );
}
