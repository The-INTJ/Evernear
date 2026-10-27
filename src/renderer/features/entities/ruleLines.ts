// The entity dialog edits an entity's rules as plain text: one regex per
// line, blank lines ignored, and a leading "#" keeping a rule but turning
// it off.

import type { MatchingRuleInput, MatchingRuleRecord } from "../../../shared/domain/workspace";
import { compileMatchingPattern } from "../../../shared/matchingPatterns";

export type RuleLineError = {
  line: number;
  message: string;
};

export type ParsedRuleLines = {
  rules: MatchingRuleInput[];
  errors: RuleLineError[];
};

export function parseRuleLines(text: string): ParsedRuleLines {
  const rules: MatchingRuleInput[] = [];
  const errors: RuleLineError[] = [];

  text.split(/\r?\n/).forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) return;
    const enabled = !line.startsWith("#");
    const pattern = enabled ? line : line.slice(1).trim();
    if (!pattern) return;

    const compiled = compileMatchingPattern(pattern);
    if (compiled.ok) {
      rules.push({ pattern, enabled });
    } else {
      errors.push({ line: index + 1, message: compiled.error });
    }
  });

  return { rules, errors };
}

// Oldest rule first, so lines keep their place across saves. An enabled
// pattern that itself starts with "#" is written as "[#]" so it doesn't
// come back switched off.
export function formatRuleLines(rules: MatchingRuleRecord[]): string {
  return [...rules]
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .map((rule) => {
      if (!rule.enabled) return `# ${rule.pattern}`;
      return rule.pattern.startsWith("#") ? `[#]${rule.pattern.slice(1)}` : rule.pattern;
    })
    .join("\n");
}
