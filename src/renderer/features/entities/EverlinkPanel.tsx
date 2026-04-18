import type { DocumentSummary, MatchingRuleKind, WorkspaceState } from "../../../shared/domain/workspace";
import type { EverlinkSession } from "../../state/sessionTypes";
import { truncate } from "../../utils/formatting";

type Props = {
  session: EverlinkSession;
  workspace: WorkspaceState | null;
  documentsById: Map<string, DocumentSummary>;
  onSessionChange: React.Dispatch<React.SetStateAction<EverlinkSession | null>>;
  onBeginPlacement: () => void;
  onCreateTargetDocument: () => void;
  onCancel: () => void;
};

export function EverlinkPanel(props: Props) {
  const { session, workspace, documentsById, onSessionChange, onBeginPlacement, onCreateTargetDocument, onCancel } = props;

  return (
    <section className="panel-section">
      <p className="section-kicker">Everlink it!</p>
      <h2>{session.mode === "edit" ? "Edit Entity Linkage" : "Create or Extend an Entity"}</h2>
      <p className="section-copy">
        The current selection stays as clean manuscript text. This flow only creates or extends entity truth and then moves into slice placement.
      </p>
      <div className="selection-card">
        <strong>Selected text</strong>
        <span>{truncate(session.sourceText, 120)}</span>
      </div>
      <label className="field-stack">
        <span className="field-label">Attach to existing entity</span>
        <select
          className="select-input"
          value={session.selectedEntityId ?? ""}
          onChange={(event) => onSessionChange((current) => current ? {
            ...current,
            selectedEntityId: event.target.value || null,
            mode: event.target.value ? "attach" : "create",
          } : current)}
        >
          <option value="">Create a new entity</option>
          {(workspace?.entities ?? []).map((entity) => (
            <option key={entity.id} value={entity.id}>{entity.name}</option>
          ))}
        </select>
      </label>
      {!session.selectedEntityId ? (
        <label className="field-stack">
          <span className="field-label">New entity name</span>
          <input
            className="text-input"
            value={session.entityNameDraft}
            onChange={(event) => onSessionChange((current) => current ? { ...current, entityNameDraft: event.target.value } : current)}
          />
        </label>
      ) : null}
      <div className="form-grid">
        <label className="field-stack">
          <span className="field-label">Initial rule kind</span>
          <select
            className="select-input"
            value={session.ruleKind}
            onChange={(event) => onSessionChange((current) => current ? {
              ...current,
              ruleKind: event.target.value as MatchingRuleKind,
            } : current)}
          >
            <option value="literal">Literal</option>
            <option value="alias">Alias</option>
            <option value="regex">Regex</option>
          </select>
        </label>
        <label className="field-stack">
          <span className="field-label">Target document</span>
          <select
            className="select-input"
            value={session.targetDocumentId ?? ""}
            onChange={(event) => onSessionChange((current) => current ? { ...current, targetDocumentId: event.target.value } : current)}
          >
            {workspace?.layout.recentTargetDocumentIds.map((documentId) => {
              const document = documentsById.get(documentId);
              return document ? <option key={document.id} value={document.id}>{document.title}</option> : null;
            })}
            {(workspace?.documents ?? [])
              .filter((document) => !workspace?.layout.recentTargetDocumentIds.includes(document.id))
              .map((document) => (
                <option key={document.id} value={document.id}>{document.title}</option>
              ))}
            <option value="__create__">Create new target document...</option>
          </select>
        </label>
      </div>
      {session.targetDocumentId === "__create__" ? (
        <div className="toolbar-actions">
          <input
            className="text-input"
            value={session.newTargetDocumentTitle}
            onChange={(event) => onSessionChange((current) => current ? { ...current, newTargetDocumentTitle: event.target.value } : current)}
            placeholder="New target document title"
          />
          <button className="ghost-button" onClick={onCreateTargetDocument} type="button">Create Target Doc</button>
        </div>
      ) : null}
      <div className="toolbar-actions">
        <button className="primary-button" onClick={onBeginPlacement} type="button">Continue to Slice Placement</button>
        <button className="secondary-button" onClick={onCancel} type="button">Cancel</button>
      </div>
    </section>
  );
}
