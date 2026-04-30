import type { MatchingRuleKind, MatchingRuleRecord } from "../../../shared/domain/workspace";
import type { RuleFormState } from "../../state/sessionTypes";
import {
  Button,
  Card,
  PanelSection,
  SelectInput,
  TextInput,
  cardStyles,
  classNames,
} from "../../ui";
import styles from "./EntityPanels.module.css";

type Props = {
  ruleForm: RuleFormState;
  selectedEntityRules: MatchingRuleRecord[];
  onRuleFormChange: React.Dispatch<React.SetStateAction<RuleFormState>>;
  onAddRule: () => void;
  onToggleRule: (rule: MatchingRuleRecord) => void;
  onDeleteRule: (ruleId: string) => void;
};

export function MatchingRuleEditor({
  ruleForm,
  selectedEntityRules,
  onRuleFormChange,
  onAddRule,
  onToggleRule,
  onDeleteRule,
}: Props) {
  return (
    <PanelSection>
      <h2>Matching Rules</h2>
      <div className={classNames(styles.formGrid, styles.formGridStack)}>
        <TextInput
          value={ruleForm.label}
          onChange={(event) =>
            onRuleFormChange((current) => ({ ...current, label: event.target.value }))
          }
          placeholder="Rule label"
        />
        <TextInput
          value={ruleForm.pattern}
          onChange={(event) =>
            onRuleFormChange((current) => ({ ...current, pattern: event.target.value }))
          }
          placeholder="Pattern"
        />
        <div className={styles.actions}>
          <SelectInput
            value={ruleForm.kind}
            onChange={(event) =>
              onRuleFormChange((current) => ({
                ...current,
                kind: event.target.value as MatchingRuleKind,
              }))
            }
          >
            <option value="literal">Literal</option>
            <option value="alias">Alias</option>
            <option value="regex">Regex</option>
          </SelectInput>
          <label className={styles.checkboxRow}>
            <input
              checked={ruleForm.wholeWord}
              onChange={(event) =>
                onRuleFormChange((current) => ({ ...current, wholeWord: event.target.checked }))
              }
              type="checkbox"
            />
            Whole word
          </label>
          <label className={styles.checkboxRow}>
            <input
              checked={ruleForm.allowPossessive}
              onChange={(event) =>
                onRuleFormChange((current) => ({
                  ...current,
                  allowPossessive: event.target.checked,
                }))
              }
              type="checkbox"
            />
            Allow possessive
          </label>
          <Button size="compact" onClick={onAddRule}>
            Add Rule
          </Button>
        </div>
      </div>
      <div className={styles.list}>
        {selectedEntityRules.length === 0 ? (
          <p className={styles.empty}>This entity does not have any rules yet.</p>
        ) : (
          selectedEntityRules.map((rule) => (
            <Card key={rule.id}>
              <div className={cardStyles.meta}>
                <strong>{rule.label}</strong>
                <span>{rule.kind}</span>
              </div>
              <p className={cardStyles.copy}>{rule.pattern}</p>
              <div className={styles.actions}>
                <Button size="compact" onClick={() => onToggleRule(rule)}>
                  {rule.enabled ? "Disable" : "Enable"}
                </Button>
                <Button size="compact" tone="danger" onClick={() => onDeleteRule(rule.id)}>
                  Delete
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>
    </PanelSection>
  );
}
