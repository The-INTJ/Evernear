import { forwardRef } from "react";

import type { StoredDocumentSnapshot } from "../../../shared/domain/document";
import type {
  SliceBoundaryRecord,
  WorkspaceState,
} from "../../../shared/domain/workspace";
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

type Props = {
  workspace: WorkspaceState | null;
  activeDocument: StoredDocumentSnapshot | null;
  emptyDocumentJson: unknown;
  emptyDocumentKey: string;
  editorRules: EditorMatchingRule[];
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
    visibleBoundaries,
    pendingRange,
    onSnapshotChange,
    onSelectionChange,
    onEntityHover,
    onEntityClick,
    onEditorContextMenu,
    onEditorBlur,
  } = props;

  return (
    <section className="editor-panel">
      <div className="editor-canvas">
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
