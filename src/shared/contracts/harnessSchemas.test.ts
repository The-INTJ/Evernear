// The schemas are the trust boundary for writes from the renderer. A
// matching rule whose pattern doesn't compile must be refused there, before
// it can reach the database and every editor's highlight pass.

import { describe, expect, it } from "vitest";

import { CreateEntityInputSchema, SetEntityRulesInputSchema, parseInput } from "./harnessSchemas";

const rules = [{ pattern: "\\bThe\\s+Spire\\b", enabled: true }];

describe("SetEntityRulesInputSchema", () => {
  it("accepts valid regexes", () => {
    expect(SetEntityRulesInputSchema.safeParse({ entityId: "entity-1", rules }).success).toBe(true);
  });

  it("rejects a pattern that doesn't compile, naming the problem", () => {
    const input = { entityId: "entity-1", rules: [...rules, { pattern: "(", enabled: true }] };
    expect(() => parseInput(SetEntityRulesInputSchema, input, "setEntityRules"))
      .toThrow(/rules\.1\.pattern: Not a valid regex: .*unterminated group/i);
  });

  it("rejects an empty pattern", () => {
    const input = { entityId: "entity-1", rules: [{ pattern: "", enabled: true }] };
    expect(SetEntityRulesInputSchema.safeParse(input).success).toBe(false);
  });
});

describe("CreateEntityInputSchema", () => {
  it("accepts an entity with or without starting rules", () => {
    expect(CreateEntityInputSchema.safeParse({ projectId: "p", name: "The Spire" }).success).toBe(true);
    expect(CreateEntityInputSchema.safeParse({ projectId: "p", name: "The Spire", rules }).success).toBe(true);
  });

  it("validates starting rules like any other rule", () => {
    const input = { projectId: "p", name: "The Spire", rules: [{ pattern: "[", enabled: true }] };
    expect(CreateEntityInputSchema.safeParse(input).success).toBe(false);
  });
});
