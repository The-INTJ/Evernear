import { forwardRef } from "react";

import {
  collectDocumentMetrics,
  type StoredDocumentSnapshot,
} from "../../../shared/domain/document";
import type {
  DocumentSummary,
  SliceBoundaryRecord,
  WorkspaceState,
  WorkspaceStatus,
} from "../../../shared/domain/workspace";
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
import { formatCount } from "../../utils/formatting";
import { DEBUG_PANELS } from "../../utils/devFlags";

type Props = {
  workspace: WorkspaceState | null;
  activeDocument: StoredDocumentSnapshot | null;
  status: WorkspaceStatus | null;
  documentTitleDraft: string;
  onDocumentTitleDraftChange: (value: string) => void;
  onSaveDocumentMeta: (folderId?: string | null) => void;
  onReorderDocument: (direction: "up" | "down") => void;
  onToggleHighlights: () => void;
  onDeleteDocument: () => void;
  onOpenEverlinkChooser: () => void;
  everlinkLabel: string;
  onOpenEverslice: () => void;
  eversliceDisabled: boolean;
  pendingWrites: number;
  documentsById: Map<string, DocumentSummary>;
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
  onEditorBlur: () => void;
  fullScreen?: boolean;
  onToggleFullScreen?: () => void;
};

// Forward-ref so App.tsx can still drive bold/italic toggles and
// replaceSelection during the slice commit flow.
export const EditorPane = forwardRef<HarnessEditorHandle, Props>(function EditorPane(props, ref) {
  const {
    workspace,
    activeDocument,
    status,
    documentTitleDraft,
    onDocumentTitleDraftChange,
    onSaveDocumentMeta,
    onReorderDocument,
    onToggleHighlights,
    onDeleteDocument,
    onOpenEverlinkChooser,
    everlinkLabel,
    onOpenEverslice,
    eversliceDisabled,
    pendingWrites,
    documentsById,
    emptyDocumentJson,
    emptyDocumentKey,
    editorRules,
    visibleBoundaries,
    pendingRange,
    onSnapshotChange,
    onSelectionChange,
    onEntityHover,
    onEntityClick,
    onEditorBlur,
    fullScreen,
    onToggleFullScreen,
  } = props;

  const metrics = activeDocument ? collectDocumentMetrics(activeDocument.plainText) : null;

  return (
    <section className="editor-panel">
      <div className="editor-toolbar">
        <div className="field-stack field-stack--grow">
          <span className="field-label">Document</span>
          <input
            className="text-input text-input--title"
            value={documentTitleDraft}
            onChange={(event) => onDocumentTitleDraftChange(event.target.value)}
            onBlur={() => onSaveDocumentMeta()}
            placeholder="Document title"
          />
        </div>
        <label className="field-stack field-stack--compact">
          <span className="field-label">Folder</span>
          <select
            className="select-input"
            value={activeDocument ? documentsById.get(activeDocument.id)?.folderId ?? "" : ""}
            onChange={(event) => onSaveDocumentMeta(event.target.value || null)}
          >
            <option value="">Project Root</option>
            {(workspace?.folders ?? []).map((folder) => (
              <option key={folder.id} value={folder.id}>{folder.title}</option>
            ))}
          </select>
        </label>
        <div className="toolbar-actions">
          <ToolbarButtons
            forwardedRef={ref}
            onReorderDocument={onReorderDocument}
            onToggleHighlights={onToggleHighlights}
            onOpenEverlinkChooser={onOpenEverlinkChooser}
            onOpenEverslice={onOpenEverslice}
            eversliceDisabled={eversliceDisabled}
            onDeleteDocument={onDeleteDocument}
            workspace={workspace}
            everlinkLabel={everlinkLabel}
            fullScreen={fullScreen ?? false}
            onToggleFullScreen={onToggleFullScreen}
          />
        </div>
      </div>

      <div className={DEBUG_PANELS ? "editor-statusbar" : "editor-statusbar editor-statusbar--compact"}>
        <MetricCard label="Words" value={formatCount(metrics?.wordCount ?? 0)} />
        <MetricCard label="Paragraphs" value={formatCount(metrics?.paragraphCount ?? 0)} />
        <MetricCard label="Characters" value={formatCount(metrics?.characterCount ?? 0)} />
        {DEBUG_PANELS ? (
          <MetricCard label="Storage" value={status?.storageEngine ?? "better-sqlite3"} />
        ) : null}
        <MetricCard label="Sync" value={pendingWrites > 0 ? "Saving..." : "Saved"} />
      </div>

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
          onBlur={onEditorBlur}
        />
      </div>
    </section>
  );
});

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="metric-card">
      <span className="metric-card__label">{label}</span>
      <strong className="metric-card__value">{value}</strong>
    </article>
  );
}

// Small isolated component so we can access the forwarded ref via a
// local handle for the bold/italic toggles. Keeps EditorPane itself
// free of the imperative ref-call pattern.
function ToolbarButtons({
  forwardedRef,
  onReorderDocument,
  onToggleHighlights,
  onOpenEverlinkChooser,
  onOpenEverslice,
  eversliceDisabled,
  onDeleteDocument,
  workspace,
  everlinkLabel,
  fullScreen,
  onToggleFullScreen,
}: {
  forwardedRef: React.ForwardedRef<HarnessEditorHandle>;
  onReorderDocument: (direction: "up" | "down") => void;
  onToggleHighlights: () => void;
  onOpenEverlinkChooser: () => void;
  onOpenEverslice: () => void;
  eversliceDisabled: boolean;
  onDeleteDocument: () => void;
  workspace: WorkspaceState | null;
  everlinkLabel: string;
  fullScreen: boolean;
  onToggleFullScreen?: () => void;
}) {
  const resolveRef = (): HarnessEditorHandle | null => {
    if (!forwardedRef || typeof forwardedRef === "function") return null;
    return forwardedRef.current;
  };

  return (
    <>
      <button className="ghost-button" onClick={() => resolveRef()?.toggleBold()} type="button">Bold</button>
      <button className="ghost-button" onClick={() => resolveRef()?.toggleItalic()} type="button">Italic</button>
      <button className="ghost-button" onClick={() => onReorderDocument("up")} type="button">Move Up</button>
      <button className="ghost-button" onClick={() => onReorderDocument("down")} type="button">Move Down</button>
      <button className="ghost-button" onClick={onToggleHighlights} type="button">
        {workspace?.layout.highlightsEnabled ? "Mute Highlights" : "Show Highlights"}
      </button>
      {onToggleFullScreen ? (
        <button className="ghost-button" onClick={onToggleFullScreen} type="button">
          {fullScreen ? "Exit Full Screen" : "Full Screen"}
        </button>
      ) : null}
      <button className="primary-button" onClick={onOpenEverslice} type="button" disabled={eversliceDisabled}>Everslice it!</button>
      <button className="primary-button" onClick={onOpenEverlinkChooser} type="button">{everlinkLabel}</button>
      <button className="ghost-button ghost-button--danger" onClick={onDeleteDocument} type="button">
        Delete Doc
      </button>
    </>
  );
}
