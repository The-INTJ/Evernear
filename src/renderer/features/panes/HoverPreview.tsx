import type { EntityRecord } from "../../../shared/domain/workspace";
import type { HoverPreview as HoverPreviewState } from "../../state/sessionTypes";
import type { ResolvedSliceView } from "../../utils/workspace";
import { formatBoundaryReason } from "../../utils/formatting";

type Props = {
  hover: HoverPreviewState;
  entity: EntityRecord | null;
  slices: ResolvedSliceView[];
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
};

export function HoverPreview({ hover, entity, slices, onMouseEnter, onMouseLeave }: Props) {
  if (!entity) return null;
  return (
    <div
      className="hover-preview"
      style={{ left: hover.x + 18, top: hover.y + 18 }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="hover-preview__header">
        <p className="section-kicker">Preview</p>
        <h3>{entity.name}</h3>
      </div>
      <div className="hover-preview__body">
        {slices.length === 0 ? (
          <p className="empty-state">No linked slices yet.</p>
        ) : slices.map(({ slice, boundary, document }) => (
          <article key={slice.id} className="stack-card stack-card--neutral">
            <div className="stack-card__meta">
              <strong>{slice.title}</strong>
              <span>{document?.title ?? "Document"}</span>
            </div>
            <p className="stack-card__copy hover-preview__excerpt">{slice.excerpt}</p>
            {boundary ? <p className="stack-card__reason">{formatBoundaryReason(boundary.resolution.reason)}</p> : null}
          </article>
        ))}
      </div>
    </div>
  );
}
