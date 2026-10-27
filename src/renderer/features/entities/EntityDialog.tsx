import { useMemo, useState } from "react";
import type { KeyboardEvent } from "react";

import type {
  EntityRecord,
  MatchingRuleInput,
  MatchingRuleRecord,
} from "../../../shared/domain/workspace";
import { Button, ModalShell, TextInput, modalShellStyles } from "../../ui";
import { formatRuleLines, parseRuleLines } from "./ruleLines";
import styles from "./EntityDialog.module.css";

type Props = {
  entity: EntityRecord;
  rules: MatchingRuleRecord[];
  sliceCount: number;
  onSave: (entityId: string, name: string, rules: MatchingRuleInput[]) => Promise<boolean>;
  onDelete: (entityId: string) => void;
  onClose: () => void;
};

// Stopgap entity editor until the full-page one lands: a name, the rules
// as one regex per line, and delete. The parent keys it by entity id, so
// drafts start fresh for each entity without a syncing effect.
export function EntityDialog({ entity, rules, sliceCount, onSave, onDelete, onClose }: Props) {
  const [nameDraft, setNameDraft] = useState(entity.name);
  const [rulesDraft, setRulesDraft] = useState(() => formatRuleLines(rules));
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  const parsed = useMemo(() => parseRuleLines(rulesDraft), [rulesDraft]);
  const canSave = !saving && nameDraft.trim().length > 0 && parsed.errors.length === 0;
  const lineCount = rulesDraft.split("\n").length;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    const saved = await onSave(entity.id, nameDraft, parsed.rules);
    if (saved) {
      onClose();
    } else {
      setSaving(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      // Stop here: the window-level Esc (leave slice editing) must not
      // also fire for the key that closed this dialog.
      event.preventDefault();
      event.stopPropagation();
      onClose();
    } else if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void save();
    }
  };

  return (
    <ModalShell aria-label={`Edit ${entity.name}`} onKeyDown={handleKeyDown}>
      <header className={modalShellStyles.header}>
        <h2>Entity</h2>
      </header>
      <label className={styles.field}>
        <span className={styles.label}>Name</span>
        <TextInput
          autoFocus
          value={nameDraft}
          onChange={(event) => setNameDraft(event.target.value)}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.label}>Matches</span>
        <textarea
          className={styles.rules}
          rows={Math.min(8, Math.max(3, lineCount))}
          spellCheck={false}
          value={rulesDraft}
          onChange={(event) => setRulesDraft(event.target.value)}
        />
      </label>
      <p className={styles.help}>
        One regex per line. Plain lines ignore case, <code>/&hellip;/</code> uses your own flags,
        and <code>#</code> turns a line off.
      </p>
      {parsed.errors.map((error) => (
        <p key={error.line} className={styles.error}>
          Line {error.line}: {error.message}
        </p>
      ))}
      <p className={styles.help}>{sliceCount === 1 ? "1 slice" : `${sliceCount} slices`}</p>
      <div className={styles.actions}>
        {confirmingDelete ? (
          <Button
            tone="danger"
            onClick={() => {
              onDelete(entity.id);
              onClose();
            }}
          >
            {sliceCount > 0 ? `Delete ${entity.name} and its slices` : `Delete ${entity.name}`}
          </Button>
        ) : (
          <Button tone="danger" onClick={() => setConfirmingDelete(true)}>
            Delete entity
          </Button>
        )}
        <span className={styles.spacer} />
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" disabled={!canSave} onClick={() => void save()}>
          Save
        </Button>
      </div>
    </ModalShell>
  );
}
