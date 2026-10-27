import { describe, expect, it } from "vitest";

import type { MatchingRuleRecord } from "../../../shared/domain/workspace";
import { formatRuleLines, parseRuleLines } from "./ruleLines";

function rule(pattern: string, enabled: boolean, createdAt: string): MatchingRuleRecord {
  return { id: pattern, entityId: "e1", label: pattern, pattern, enabled, createdAt, updatedAt: createdAt };
}

describe("parseRuleLines", () => {
  it("reads one regex per line, skipping blanks and turning # lines off", () => {
    const parsed = parseRuleLines("\\bThe\\s+Spire\\b\n\n  # \\bthe tower\\b  \n/\\bWill\\b/\n#\n");
    expect(parsed.errors).toEqual([]);
    expect(parsed.rules).toEqual([
      { pattern: "\\bThe\\s+Spire\\b", enabled: true },
      { pattern: "\\bthe tower\\b", enabled: false },
      { pattern: "/\\bWill\\b/", enabled: true },
    ]);
  });

  it("reports invalid lines by line number", () => {
    const parsed = parseRuleLines("\\bSpire\\b\n(\n[a");
    expect(parsed.rules).toHaveLength(1);
    expect(parsed.errors.map((error) => error.line)).toEqual([2, 3]);
  });
});

describe("formatRuleLines", () => {
  it("writes the oldest rule first and marks disabled rules with #", () => {
    const text = formatRuleLines([
      rule("\\bthe tower\\b", false, "2026-10-27T00:00:02.000Z"),
      rule("\\bThe\\s+Spire\\b", true, "2026-10-27T00:00:01.000Z"),
    ]);
    expect(text).toBe("\\bThe\\s+Spire\\b\n# \\bthe tower\\b");
  });

  it("round-trips through parseRuleLines, including a pattern that starts with #", () => {
    const rules = [
      rule("#hashtag", true, "2026-10-27T00:00:01.000Z"),
      rule("\\bSpire\\b", false, "2026-10-27T00:00:02.000Z"),
    ];
    const parsed = parseRuleLines(formatRuleLines(rules));
    expect(parsed.rules).toEqual([
      { pattern: "[#]hashtag", enabled: true },
      { pattern: "\\bSpire\\b", enabled: false },
    ]);
  });
});
