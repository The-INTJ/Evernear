import { forwardRef } from "react";

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
} from "../../editor/workbenchUtils";

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
};

export const PanelDocumentView = forwardRef<HarnessEditorHandle, Props>(
  function PanelDocumentView({ snapshot, boundaries, pendingRange, onSnapshotChange, onSelectionChange, onBlur }, ref) {
    return (
      <section className="panel-section panel-section--grow">
        <p className="section-kicker">Panel Document View</p>
        <h2>{snapshot.title}</h2>
        <div className="panel-document-view">
          <HarnessEditor
            key={snapshot.id}
            ref={ref}
            initialDocumentJson={snapshot.contentJson}
            decorationsEnabled
            matchingRules={[]}
            sliceBoundaries={boundaries}
            pendingRange={pendingRange}
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
