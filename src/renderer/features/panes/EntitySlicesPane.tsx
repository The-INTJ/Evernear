import type { EntityRecord } from "../../../shared/domain/workspace";
import type { ResolvedSliceView } from "../../utils/workspace";
import { formatBoundaryReason } from "../../utils/formatting";

type Props = {
  entity: EntityRecord | null;
  slices: ResolvedSliceView[];
  onTakeOverPane: (slice: ResolvedSliceView) => void;
  onOpenNewPane: (slice: ResolvedSliceView) => void;
  onDeleteSlice: (sliceId: string) => void;
};

export function EntitySlicesPane({ entity, slices, onTakeOverPane, onOpenNewPane, onDeleteSlice }: Props) {
  if (!entity) {
    return <p className="empty-state">Entity not found.</p>;
  }

  return (
    <section className="panel-section panel-section--grow pane-section">
      <h2>{entity.name}</h2>
      <div className="stack-list">
        {slices.length === 0 ? (
          <p className="empty-state">No slices linked yet. Use Everlink it! to place the first one.</p>
        ) : slices.map((sliceView) => {
          const { slice, boundary, document } = sliceView;
          return (
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
              <div className="toolbar-actions toolbar-actions--wrap">
                <button
                  className="ghost-button"
                  onClick={() => onTakeOverPane(sliceView)}
                  type="button"
                >
                  Take Over Pane
                </button>
                <button
                  className="ghost-button"
                  onClick={() => onOpenNewPane(sliceView)}
                  type="button"
                >
                  Open New Pane
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
          );
        })}
      </div>
    </section>
  );
}
