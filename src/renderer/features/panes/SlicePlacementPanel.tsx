import type { DocumentSummary } from "../../../shared/domain/workspace";
import type { PendingSlicePlacement } from "../../state/sessionTypes";
import { truncate } from "../../utils/formatting";

type Props = {
  placement: PendingSlicePlacement;
  documentsById: Map<string, DocumentSummary>;
  onCommit: () => void;
  onCancel: () => void;
};

export function SlicePlacementPanel({ placement, documentsById, onCommit, onCancel }: Props) {
  return (
    <section className="panel-section panel-section--grow">
      <p className="section-kicker">Slice Placement</p>
      <h2>Place the slice in the target document</h2>
      <p className="section-copy">
        Click once to set the slice start, then type, paste, or select the range you want to keep tracked. Empty placements auto-fill from the source selection on commit or blur.
      </p>
      <div className="selection-card">
        <strong>Source text</strong>
        <span>{truncate(placement.sourceText, 140)}</span>
      </div>
      <div className="selection-card">
        <strong>Target</strong>
        <span>{documentsById.get(placement.targetDocumentId)?.title ?? "Current document"}</span>
      </div>
      <div className="toolbar-actions">
        <button className="primary-button" onClick={onCommit} type="button">Commit Slice</button>
        <button className="secondary-button" onClick={onCancel} type="button">Cancel</button>
      </div>
    </section>
  );
}
