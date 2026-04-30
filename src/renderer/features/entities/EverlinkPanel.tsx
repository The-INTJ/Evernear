import type {
  DocumentSummary,
  MatchingRuleKind,
  WorkspaceState,
} from "../../../shared/domain/workspace";
import type { EverlinkSession } from "../../state/sessionTypes";
import { truncate } from "../../utils/formatting";
import { Button, Card, PanelSection, SelectInput, TextInput } from "../../ui";
import styles from "./EntityPanels.module.css";

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
  const {
    session,
    workspace,
    documentsById,
    onSessionChange,
    onBeginPlacement,
    onCreateTargetDocument,
    onCancel,
  } = props;

  return (
    <PanelSection>
      <h2>{session.mode === "edit" ? "Edit Entity Linkage" : "Create or Extend an Entity"}</h2>
      <p className={styles.copy}>
        The current selection stays as clean manuscript text. This flow only creates or extends
        entity truth and then moves into slice placement.
      </p>
      <Card variant="selection">
        <strong>Selected text</strong>
        <span>{truncate(session.sourceText, 120)}</span>
      </Card>
      <label className={styles.fieldStack}>
        <span className={styles.fieldLabel}>Attach to existing entity</span>
        <SelectInput
          value={session.selectedEntityId ?? ""}
          onChange={(event) =>
            onSessionChange((current) =>
              current
                ? {
                    ...current,
                    selectedEntityId: event.target.value || null,
                    mode: event.target.value ? "attach" : "create",
                  }
                : current,
            )
          }
        >
          <option value="">Create a new entity</option>
          {(workspace?.entities ?? []).map((entity) => (
            <option key={entity.id} value={entity.id}>
              {entity.name}
            </option>
          ))}
        </SelectInput>
      </label>
      {!session.selectedEntityId ? (
        <label className={styles.fieldStack}>
          <span className={styles.fieldLabel}>New entity name</span>
          <TextInput
            value={session.entityNameDraft}
            onChange={(event) =>
              onSessionChange((current) =>
                current ? { ...current, entityNameDraft: event.target.value } : current,
              )
            }
          />
        </label>
      ) : null}
      <div className={styles.formGrid}>
        <label className={styles.fieldStack}>
          <span className={styles.fieldLabel}>Initial rule kind</span>
          <SelectInput
            value={session.ruleKind}
            onChange={(event) =>
              onSessionChange((current) =>
                current
                  ? {
                      ...current,
                      ruleKind: event.target.value as MatchingRuleKind,
                    }
                  : current,
              )
            }
          >
            <option value="literal">Literal</option>
            <option value="alias">Alias</option>
            <option value="regex">Regex</option>
          </SelectInput>
        </label>
        <label className={styles.fieldStack}>
          <span className={styles.fieldLabel}>Target document</span>
          <SelectInput
            value={session.targetDocumentId ?? ""}
            onChange={(event) =>
              onSessionChange((current) =>
                current ? { ...current, targetDocumentId: event.target.value } : current,
              )
            }
          >
            {workspace?.layout.recentTargetDocumentIds.map((documentId) => {
              const document = documentsById.get(documentId);
              return document ? (
                <option key={document.id} value={document.id}>
                  {document.title}
                </option>
              ) : null;
            })}
            {(workspace?.documents ?? [])
              .filter(
                (document) => !workspace?.layout.recentTargetDocumentIds.includes(document.id),
              )
              .map((document) => (
                <option key={document.id} value={document.id}>
                  {document.title}
                </option>
              ))}
            <option value="__create__">Create new target document...</option>
          </SelectInput>
        </label>
      </div>
      {session.targetDocumentId === "__create__" ? (
        <div className={styles.actions}>
          <TextInput
            value={session.newTargetDocumentTitle}
            onChange={(event) =>
              onSessionChange((current) =>
                current ? { ...current, newTargetDocumentTitle: event.target.value } : current,
              )
            }
            placeholder="New target document title"
          />
          <Button size="compact" onClick={onCreateTargetDocument}>
            Create Target Doc
          </Button>
        </div>
      ) : null}
      <div className={styles.actions}>
        <Button variant="primary" size="compact" onClick={onBeginPlacement}>
          Continue to Slice Placement
        </Button>
        <Button variant="secondary" size="compact" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </PanelSection>
  );
}
