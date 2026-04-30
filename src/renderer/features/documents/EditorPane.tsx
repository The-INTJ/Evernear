import { forwardRef } from "react";

import {
  collectDocumentMetrics,
  type StoredDocumentSnapshot,
} from "../../../shared/domain/document";
import type { SliceBoundaryRecord, WorkspaceState } from "../../../shared/domain/workspace";
import {
  HarnessEditor,
  type EditorContextMenuPayload,
  type HarnessEditorHandle,
  type HarnessEditorSnapshot,
  type PendingSliceRange,
} from "../../editor/HarnessEditor";
import type {
  EditorMatchingRule,
  EditorSelectionInfo,
  SerializedTransactionBundle,
} from "../../editor/editorUtils";
import { DEBUG_PANELS } from "../../utils/devFlags";
import { formatCount } from "../../utils/formatting";
import { classNames } from "../../ui";
import styles from "./EditorPane.module.css";

type Props = {
  workspace: WorkspaceState | null;
  activeDocument: StoredDocumentSnapshot | null;
  emptyDocumentJson: unknown;
  emptyDocumentKey: string;
  editorRules: EditorMatchingRule[];
  pendingWrites: number;
  visibleBoundaries: SliceBoundaryRecord[];
  pendingRange: PendingSliceRange | null;
  onSnapshotChange: (
    snapshot: HarnessEditorSnapshot,
    transaction: SerializedTransactionBundle | null,
  ) => void;
  onSelectionChange: (selection: EditorSelectionInfo) => void;
  onEntityHover: (payload: { entityId: string; clientX: number; clientY: number } | null) => void;
  onEntityClick?: (entityId: string) => void;
  onEditorContextMenu: (payload: EditorContextMenuPayload) => void;
  onEditorBlur: () => void;
};

// Forward-ref so App.tsx can drive editor commands from the window bar
// and replaceSelection during the slice commit flow.
export const EditorPane = forwardRef<HarnessEditorHandle, Props>(function EditorPane(props, ref) {
  const {
    workspace,
    activeDocument,
    emptyDocumentJson,
    emptyDocumentKey,
    editorRules,
    pendingWrites,
    visibleBoundaries,
    pendingRange,
    onSnapshotChange,
    onSelectionChange,
    onEntityHover,
    onEntityClick,
    onEditorContextMenu,
    onEditorBlur,
  } = props;

  const metrics = activeDocument ? collectDocumentMetrics(activeDocument.plainText) : null;

  return (
    <section className={styles.panel}>
      <div className={styles.head}>
        <div className={styles.stats} aria-label="Document metrics">
          <Metric label="Words" value={formatCount(metrics?.wordCount ?? 0)} />
          <Metric label="Paras" value={formatCount(metrics?.paragraphCount ?? 0)} />
          <Metric label="Chars" value={formatCount(metrics?.characterCount ?? 0)} />
        </div>
        <div className={classNames(styles.sync, pendingWrites > 0 && styles.saving)}>
          {pendingWrites > 0 ? "Saving..." : "Saved"}
        </div>
      </div>
      <div className={styles.canvas}>
        <HarnessEditor
          key={activeDocument?.id ?? emptyDocumentKey}
          ref={ref}
          initialDocumentJson={(activeDocument?.contentJson ?? emptyDocumentJson) as never}
          decorationsEnabled
          matchingRules={workspace?.layout.highlightsEnabled ? editorRules : []}
          sliceBoundaries={visibleBoundaries}
          pendingRange={pendingRange}
          showLegend={DEBUG_PANELS}
          legendLabels={{
            match: "Entity match",
            boundary: "Slice boundary",
            pending: "Pending slice",
          }}
          onDocumentSnapshotChange={onSnapshotChange}
          onSelectionChange={onSelectionChange}
          onEntityHover={onEntityHover}
          onEntityClick={onEntityClick}
          onContextMenu={onEditorContextMenu}
          onBlur={onEditorBlur}
        />
      </div>
    </section>
  );
});

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <span className={styles.metric}>
      {label}
      <strong>{value}</strong>
    </span>
  );
}
