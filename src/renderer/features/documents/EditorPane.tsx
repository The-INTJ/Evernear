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
  EditorMatchingRule,
  EditorSelectionInfo,
  SerializedTransactionBundle,
} from "../../editor/editorUtils";
import styles from "./EditorPane.module.css";

type Props = {
  activeDocument: StoredDocumentSnapshot | null;
  emptyDocumentJson: unknown;
  emptyDocumentKey: string;
  // Already filtered by the Entities and Slices toggles.
  matchingRules: EditorMatchingRule[];
  sliceBoundaries: SliceBoundaryRecord[];
  pendingRange: PendingSliceRange | null;
  onSnapshotChange: (
    snapshot: HarnessEditorSnapshot,
    transaction: SerializedTransactionBundle | null,
  ) => void;
  onSelectionChange: (selection: EditorSelectionInfo) => void;
  onEntityHover: (payload: { entityId: string; clientX: number; clientY: number } | null) => void;
};

// The one editing surface. The editor remounts per document (keyed by id).
export const EditorPane = forwardRef<HarnessEditorHandle, Props>(function EditorPane(props, ref) {
  const {
    activeDocument,
    emptyDocumentJson,
    emptyDocumentKey,
    matchingRules,
    sliceBoundaries,
    pendingRange,
    onSnapshotChange,
    onSelectionChange,
    onEntityHover,
  } = props;

  return (
    <section className={styles.panel}>
      <div className={styles.canvas}>
        <HarnessEditor
          key={activeDocument?.id ?? emptyDocumentKey}
          ref={ref}
          initialDocumentJson={(activeDocument?.contentJson ?? emptyDocumentJson) as never}
          decorationsEnabled
          matchingRules={matchingRules}
          sliceBoundaries={sliceBoundaries}
          pendingRange={pendingRange}
          onDocumentSnapshotChange={onSnapshotChange}
          onSelectionChange={onSelectionChange}
          onEntityHover={onEntityHover}
        />
      </div>
    </section>
  );
});
