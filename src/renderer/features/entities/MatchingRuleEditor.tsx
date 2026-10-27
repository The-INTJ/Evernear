import type { MatchingRuleRecord } from "../../../shared/domain/workspace";
import { compileMatchingPattern } from "../../../shared/matchingPatterns";
import type { RuleFormState } from "../../state/sessionTypes";
import {
  Button,
  Card,
  PanelSection,
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
  const compiled = ruleForm.pattern.trim().length > 0 ? compileMatchingPattern(ruleForm.pattern) : null;
  const patternError = compiled && !compiled.ok ? compiled.error : null;
  const canAddRule = compiled?.ok === true;

  return (
    <PanelSection>
      <h2>Matching Rules</h2>
      <div className={classNames(styles.formGrid, styles.formGridStack)}>
        <TextInput
          value={ruleForm.label}
          onChange={(event) =>
            onRuleFormChange((current) => ({ ...current, label: event.target.value }))
          }
          placeholder="Rule label (optional)"
        />
        <TextInput
          value={ruleForm.pattern}
          onChange={(event) =>
            onRuleFormChange((current) => ({ ...current, pattern: event.target.value }))
          }
          placeholder="Regex, e.g. \bThe\s+Spire\b"
        />
        {patternError ? <p className={styles.empty}>Not a valid regex: {patternError}</p> : null}
        <div className={styles.actions}>
          <Button size="compact" disabled={!canAddRule} onClick={onAddRule}>
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
                <span>{compileMatchingPattern(rule.pattern).ok ? (rule.enabled ? "on" : "off") : "invalid"}</span>
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
