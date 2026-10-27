// The schemas are the trust boundary for writes from the renderer. A
// matching rule whose pattern doesn't compile must be refused there, before
// it can reach the database and every editor's highlight pass.

import { describe, expect, it } from "vitest";

import { UpsertMatchingRuleInputSchema, parseInput } from "./harnessSchemas";

const rule = {
  entityId: "entity-1",
  label: "The Spire",
  pattern: "\\bThe\\s+Spire\\b",
  enabled: true,
};

describe("UpsertMatchingRuleInputSchema", () => {
  it("accepts a valid regex", () => {
    expect(UpsertMatchingRuleInputSchema.safeParse(rule).success).toBe(true);
  });

  it("rejects a pattern that doesn't compile, naming the problem", () => {
    expect(() => parseInput(UpsertMatchingRuleInputSchema, { ...rule, pattern: "(" }, "upsert"))
      .toThrow(/pattern: Not a valid regex: .*unterminated group/i);
  });

  it("rejects an empty pattern", () => {
    expect(UpsertMatchingRuleInputSchema.safeParse({ ...rule, pattern: "" }).success).toBe(false);
  });
});
