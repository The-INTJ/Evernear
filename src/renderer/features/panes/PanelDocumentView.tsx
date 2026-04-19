import { forwardRef, useState } from "react";

import type { StoredDocumentSnapshot } from "../../../shared/domain/document";
import type { SliceBoundaryRecord } from "../../../shared/domain/workspace";
import {
  HarnessEditor,
  type HarnessEditorHandle,
  type HarnessEditorSnapshot,
  type PendingSliceRange,
} from "../../editor/HarnessEditor";
import type {
  EditorSelectionInfo,
  SerializedTransactionBundle,
} from "../../editor/editorUtils";
import { DEBUG_PANELS } from "../../utils/devFlags";

type Props = {
  snapshot: StoredDocumentSnapshot;
  boundaries: SliceBoundaryRecord[];
  pendingRange: PendingSliceRange | null;
  onSnapshotChange: (
    snapshot: HarnessEditorSnapshot,
    transaction: SerializedTransactionBundle | null,
  ) => void;
  onSelectionChange: (selection: EditorSelectionInfo) => void;
  onBlur: () => void;
  onClose?: () => void;
};

export const PanelDocumentView = forwardRef<HarnessEditorHandle, Props>(
  function PanelDocumentView({ snapshot, boundaries, pendingRange, onSnapshotChange, onSelectionChange, onBlur, onClose }, ref) {
    const [editingBoundaries, setEditingBoundaries] = useState(false);

    return (
      <section className="panel-section panel-section--grow">
        <h2>{snapshot.title}</h2>
        <div className="panel-document-view__strip">
          <button
            type="button"
            className="ghost-button"
            onClick={() => setEditingBoundaries((value) => !value)}
            aria-pressed={editingBoundaries}
          >
            {editingBoundaries ? "Done editing slices" : "Edit slices"}
          </button>
          {onClose ? (
            <button type="button" className="ghost-button" onClick={onClose}>
              Close
            </button>
          ) : null}
        </div>
        <div className="panel-document-view">
          <HarnessEditor
            key={snapshot.id}
            ref={ref}
            initialDocumentJson={snapshot.contentJson}
            decorationsEnabled
            matchingRules={[]}
            sliceBoundaries={boundaries}
            boundariesEditable={editingBoundaries}
            pendingRange={pendingRange}
            showLegend={DEBUG_PANELS}
            legendLabels={{
              match: "Panel view",
              boundary: "Slice boundary",
              pending: "Pending slice",
            }}
            onDocumentSnapshotChange={onSnapshotChange}
            onSelectionChange={onSelectionChange}
            onBlur={onBlur}
          />
        </div>
      </section>
    );
  },
);
