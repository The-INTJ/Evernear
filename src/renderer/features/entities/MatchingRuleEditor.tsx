import type { MatchingRuleKind, MatchingRuleRecord } from "../../../shared/domain/workspace";
import type { RuleFormState } from "../../state/sessionTypes";

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
    <section className="panel-section">
      <p className="section-kicker">Matching Rules</p>
      <div className="form-grid form-grid--stack">
        <input
          className="text-input"
          value={ruleForm.label}
          onChange={(event) => onRuleFormChange((current) => ({ ...current, label: event.target.value }))}
          placeholder="Rule label"
        />
        <input
          className="text-input"
          value={ruleForm.pattern}
          onChange={(event) => onRuleFormChange((current) => ({ ...current, pattern: event.target.value }))}
          placeholder="Pattern"
        />
        <div className="toolbar-actions">
          <select
            className="select-input"
            value={ruleForm.kind}
            onChange={(event) => onRuleFormChange((current) => ({
              ...current,
              kind: event.target.value as MatchingRuleKind,
            }))}
          >
            <option value="literal">Literal</option>
            <option value="alias">Alias</option>
            <option value="regex">Regex</option>
          </select>
          <label className="checkbox-row">
            <input
              checked={ruleForm.wholeWord}
              onChange={(event) => onRuleFormChange((current) => ({ ...current, wholeWord: event.target.checked }))}
              type="checkbox"
            />
            Whole word
          </label>
          <label className="checkbox-row">
            <input
              checked={ruleForm.allowPossessive}
              onChange={(event) => onRuleFormChange((current) => ({ ...current, allowPossessive: event.target.checked }))}
              type="checkbox"
            />
            Allow possessive
          </label>
          <button className="ghost-button" onClick={onAddRule} type="button">Add Rule</button>
        </div>
      </div>
      <div className="stack-list">
        {selectedEntityRules.length === 0 ? (
          <p className="empty-state">This entity does not have any rules yet.</p>
        ) : (
          selectedEntityRules.map((rule) => (
            <article key={rule.id} className="stack-card">
              <div className="stack-card__meta">
                <strong>{rule.label}</strong>
                <span>{rule.kind}</span>
              </div>
              <p className="stack-card__copy">{rule.pattern}</p>
              <div className="toolbar-actions">
                <button className="ghost-button" onClick={() => onToggleRule(rule)} type="button">
                  {rule.enabled ? "Disable" : "Enable"}
                </button>
                <button className="ghost-button ghost-button--danger" onClick={() => onDeleteRule(rule.id)} type="button">
                  Delete
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
