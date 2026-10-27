import { describe, expect, it } from "vitest";

import {
  compileMatchingPattern,
  patternFromText,
  patternMatchesWholeText,
} from "./matchingPatterns";

function matches(pattern: string, text: string): string[] {
  const compiled = compileMatchingPattern(pattern);
  if (!compiled.ok) throw new Error(compiled.error);
  return [...text.matchAll(compiled.regex)].map((match) => match[0]);
}

describe("compileMatchingPattern", () => {
  it("matches a bare pattern ignoring case", () => {
    expect(matches("\\bthe spire\\b", "The Spire rose over the spire.")).toEqual(["The Spire", "the spire"]);
  });

  it("uses the author's flags in /slash/ form", () => {
    expect(matches("/\\bWill\\b/", "Will said he will.")).toEqual(["Will"]);
    expect(matches("/\\bwill\\b/i", "Will said he will.")).toEqual(["Will", "will"]);
  });

  it("makes \\b work for accented names", () => {
    expect(matches("\\bÉowyn\\b", "Then Éowyn rode.")).toEqual(["Éowyn"]);
    expect(matches("\\bowyn\\b", "Then Éowyn rode.")).toEqual([]);
  });

  it("leaves [\\b] inside a character class alone", () => {
    expect(matches("a[\\b]b", "a\bb")).toEqual(["a\bb"]);
  });

  it("reports an invalid regex instead of throwing", () => {
    const compiled = compileMatchingPattern("(");
    expect(compiled.ok).toBe(false);
    expect(!compiled.ok && compiled.error).toMatch(/unterminated group/i);
  });

  it("rejects empty patterns and unsupported flags", () => {
    expect(compileMatchingPattern("   ").ok).toBe(false);
    expect(compileMatchingPattern("/spire/y").ok).toBe(false);
  });
});

describe("patternFromText", () => {
  it("builds a word-bounded pattern that tolerates any whitespace between words", () => {
    expect(patternFromText("The Spire")).toBe("\\bThe\\s+Spire\\b");
    expect(matches(patternFromText("The Spire"), "toward the\n  Spire, the Spires")).toEqual(["the\n  Spire"]);
  });

  it("escapes regex syntax and treats straight and curly apostrophes alike", () => {
    expect(matches(patternFromText("Dr. Who (Elder)"), "Dr. Who (Elder) left.")).toEqual(["Dr. Who (Elder)"]);
    expect(matches(patternFromText("Kael'thas"), "Kael’thas and Kael'thas")).toEqual(["Kael’thas", "Kael'thas"]);
  });

  it("only adds word edges where the phrase starts or ends with a word character", () => {
    expect(patternFromText("'Tis")).toBe("['’]Tis\\b");
    expect(patternFromText("Spire", false)).toBe("Spire");
  });
});

describe("patternMatchesWholeText", () => {
  it("is true only when one match covers the whole text", () => {
    const compiled = compileMatchingPattern(patternFromText("The Spire"));
    if (!compiled.ok) throw new Error(compiled.error);
    expect(patternMatchesWholeText(compiled.regex, "the Spire")).toBe(true);
    expect(patternMatchesWholeText(compiled.regex, "the Spire rose")).toBe(false);
    // Repeated calls share the regex; matchAll must not leak lastIndex.
    expect(patternMatchesWholeText(compiled.regex, "The Spire")).toBe(true);
  });
});
