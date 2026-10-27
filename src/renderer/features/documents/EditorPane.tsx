import { forwardRef, type ReactNode } from "react";

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
import { classNames } from "../../ui";
import styles from "./EditorPane.module.css";

type Props = {
  activeDocument: StoredDocumentSnapshot | null;
  emptyDocumentJson: unknown;
  emptyDocumentKey: string;
  // Already filtered by the Entities and Slices toggles.
  matchingRules: EditorMatchingRule[];
  sliceBoundaries: SliceBoundaryRecord[];
  pendingRange: PendingSliceRange | null;
  // Edit slices: framed in the slice color, handles on, the bar above.
  editing: boolean;
  focusedSliceId: string | null;
  editBar?: ReactNode;
  onSnapshotChange: (
    snapshot: HarnessEditorSnapshot,
    transaction: SerializedTransactionBundle | null,
  ) => void;
  onSelectionChange: (selection: EditorSelectionInfo) => void;
  onEntityHover: (payload: { entityId: string; clientX: number; clientY: number } | null) => void;
  onBoundaryChange: (sliceId: string, from: number, to: number) => void;
  onSliceFocus: (sliceId: string | null) => void;
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
    editing,
    focusedSliceId,
    editBar,
    onSnapshotChange,
    onSelectionChange,
    onEntityHover,
    onBoundaryChange,
    onSliceFocus,
  } = props;

  return (
    <section className={classNames(styles.panel, editing && styles.editing)}>
      {editing ? editBar : null}
      <div className={styles.canvas}>
        <HarnessEditor
          key={activeDocument?.id ?? emptyDocumentKey}
          ref={ref}
          initialDocumentJson={(activeDocument?.contentJson ?? emptyDocumentJson) as never}
          decorationsEnabled
          matchingRules={matchingRules}
          sliceBoundaries={sliceBoundaries}
          boundariesEditable={editing}
          focusedSliceId={focusedSliceId}
          pendingRange={pendingRange}
          onDocumentSnapshotChange={onSnapshotChange}
          onSelectionChange={onSelectionChange}
          onEntityHover={onEntityHover}
          onBoundaryChange={onBoundaryChange}
          onSliceFocus={onSliceFocus}
        />
      </div>
    </section>
  );
});
