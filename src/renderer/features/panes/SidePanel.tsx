import type { Dispatch, Ref, SetStateAction } from "react";

import type { StoredDocumentSnapshot } from "../../../shared/domain/document";
import type {
  DocumentSummary,
  EntityRecord,
  MatchingRuleRecord,
  SliceBoundaryRecord,
  WorkspaceState,
} from "../../../shared/domain/workspace";
import type { HarnessEditorHandle, HarnessEditorSnapshot } from "../../editor/HarnessEditor";
import type { EditorSelectionInfo, SerializedTransactionBundle } from "../../editor/editorUtils";
import type { EverlinkPlacementHook } from "../../state/useEverlinkPlacement";
import type { WorkspaceActions } from "../../state/useWorkspaceActions";
import type { RuleFormState, RunLogEntry } from "../../state/sessionTypes";
import type { ResolvedSliceView } from "../../utils/workspace";
import { DEBUG_PANELS } from "../../utils/devFlags";
import { EntityDetail } from "../entities/EntityDetail";
import { EntityList } from "../entities/EntityList";
import { EverlinkPanel } from "../entities/EverlinkPanel";
import { MatchingRuleEditor } from "../entities/MatchingRuleEditor";
import { RunLog } from "../history/RunLog";
import { PanelDocumentView } from "./PanelDocumentView";
import { SlicePlacementPanel } from "./SlicePlacementPanel";
import { SliceViewer } from "./SliceViewer";
import styles from "./SidePanel.module.css";

type Props = {
  actions: WorkspaceActions;
  documentsById: Map<string, DocumentSummary>;
  entityNameDraft: string;
  everlink: EverlinkPlacementHook;
  onEntityNameDraftChange: Dispatch<SetStateAction<string>>;
  onPanelSnapshotChange: (
    snapshot: HarnessEditorSnapshot,
    transaction: SerializedTransactionBundle | null,
  ) => void;
  onRuleFormChange: Dispatch<SetStateAction<RuleFormState>>;
  panelDocument: StoredDocumentSnapshot | null;
  panelEditorRef: Ref<HarnessEditorHandle>;
  panelVisibleBoundaries: SliceBoundaryRecord[];
  ruleForm: RuleFormState;
  runLog: RunLogEntry[];
  selectedEntity: EntityRecord | null;
  selectedEntityRules: MatchingRuleRecord[];
  selectedEntitySlices: ResolvedSliceView[];
  workspace: WorkspaceState;
};

export function SidePanel({
  actions,
  documentsById,
  entityNameDraft,
  everlink,
  onEntityNameDraftChange,
  onPanelSnapshotChange,
  onRuleFormChange,
  panelDocument,
  panelEditorRef,
  panelVisibleBoundaries,
  ruleForm,
  runLog,
  selectedEntity,
  selectedEntityRules,
  selectedEntitySlices,
  workspace,
}: Props) {
  return (
    <aside className={styles.sidePanel}>
      {everlink.everlinkSession ? (
        <EverlinkPanel
          session={everlink.everlinkSession}
          workspace={workspace}
          documentsById={documentsById}
          onSessionChange={everlink.setSession}
          onBeginPlacement={() => void everlink.beginPlacement()}
          onCreateTargetDocument={() => void everlink.createTargetDocumentFromChooser()}
          onCancel={() => void everlink.cancelFlow()}
        />
      ) : null}

      {everlink.pendingPlacement ? (
        <SlicePlacementPanel
          placement={everlink.pendingPlacement}
          documentsById={documentsById}
          onCommit={() => void everlink.commitPendingSlice()}
          onCancel={() => void everlink.cancelFlow()}
        />
      ) : null}

      {!everlink.everlinkSession && !everlink.pendingPlacement ? (
        <>
          <EntityList
            workspace={workspace}
            selectedEntity={selectedEntity}
            onSelectEntity={actions.selectEntity}
            onCreateManualEntity={actions.createManualEntity}
          />

          {selectedEntity ? (
            <>
              <EntityDetail
                entityNameDraft={entityNameDraft}
                onEntityNameDraftChange={onEntityNameDraftChange}
                onSaveEntityName={actions.saveEntityName}
                onDeleteEntity={actions.deleteEntity}
              />

              <MatchingRuleEditor
                ruleForm={ruleForm}
                selectedEntityRules={selectedEntityRules}
                onRuleFormChange={onRuleFormChange}
                onAddRule={actions.createEntityRule}
                onToggleRule={actions.toggleRule}
                onDeleteRule={actions.deleteRule}
              />

              <SliceViewer
                selectedEntity={selectedEntity}
                entitySlices={selectedEntitySlices}
                onOpenSliceInPanel={actions.openSliceInPanel}
                onDeleteSlice={actions.deleteSlice}
              />

              {panelDocument ? (
                <PanelDocumentView
                  ref={panelEditorRef}
                  snapshot={panelDocument}
                  boundaries={panelVisibleBoundaries}
                  pendingRange={everlink.panelPendingRange}
                  onSnapshotChange={onPanelSnapshotChange}
                  onSelectionChange={(selection: EditorSelectionInfo) =>
                    everlink.handleSelectionChange("panel", selection)
                  }
                  onBlur={() => void everlink.handlePanelBlur()}
                  onClose={actions.closePanelDocument}
                />
              ) : null}
            </>
          ) : null}
        </>
      ) : null}

      {DEBUG_PANELS ? <RunLog entries={runLog} /> : null}
    </aside>
  );
}
