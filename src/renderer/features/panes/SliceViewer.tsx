import type { EntityRecord } from "../../../shared/domain/workspace";
import type { ResolvedSliceView } from "../../utils/workspace";
import { formatBoundaryReason } from "../../utils/formatting";

type Props = {
  selectedEntity: EntityRecord;
  entitySlices: ResolvedSliceView[];
  onOpenSliceInPanel: (documentId: string, entityId: string) => void;
  onDeleteSlice: (sliceId: string) => void;
};

export function SliceViewer({ selectedEntity, entitySlices, onOpenSliceInPanel, onDeleteSlice }: Props) {
  return (
    <section className="panel-section panel-section--grow">
      <h2>Slice Viewer</h2>
      <div className="stack-list">
        {entitySlices.length === 0 ? (
          <p className="empty-state">No slices linked yet. Use Everlink it! to place the first one.</p>
        ) : entitySlices.map(({ slice, boundary, document }) => (
          <article
            key={slice.id}
            className={`stack-card ${boundary ? `stack-card--${boundary.resolution.status}` : "stack-card--neutral"}`}
          >
            <div className="stack-card__meta">
              <strong>{slice.title}</strong>
              <span>{document?.title ?? "Document"}</span>
            </div>
            <p className="stack-card__copy">{slice.excerpt}</p>
            <p className="stack-card__copy">
              {boundary ? formatBoundaryReason(boundary.resolution.reason) : "Boundary record missing"}
            </p>
            <div className="toolbar-actions">
              <button
                className="ghost-button"
                onClick={() => onOpenSliceInPanel(slice.documentId, selectedEntity.id)}
                type="button"
              >
                Open in Panel
              </button>
              <button
                className="ghost-button ghost-button--danger"
                onClick={() => onDeleteSlice(slice.id)}
                type="button"
              >
                Delete
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
