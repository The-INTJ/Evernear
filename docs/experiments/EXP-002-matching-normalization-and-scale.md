# EXP-002: Matching Normalization and Chapter-Scale Performance

## Status
Planned

## Date
2026-04-17

## Parent reads
- [FOR_HUMAN_AND_AI_ROADMAP--DOC.md](../../FOR_HUMAN_AND_AI_ROADMAP--DOC.md)
- [FOR_HUMAN_CODE--DOC.md](../../FOR_HUMAN_CODE--DOC.md)
- [src/renderer/editor/OPEN_QUESTIONS.md](../../src/renderer/editor/OPEN_QUESTIONS.md)

## Question
Can matching stay trustworthy and fast when capitalization, possessives, aliases, and long manuscripts all show up at once?

## Why this is load-bearing
Entity-aware reading falls apart if matching is either too noisy, too brittle, or too slow on real chapters.

## Working hypothesis
The practical early pipeline is:

- normalize text and rules in the same way
- keep literal and alias rules on a fast path
- keep regex or exotic rules on a clearly bounded slow path
- recompute the active document immediately and the wider project in the background

## Normalization sketch
```ts
function normalizeForMatch(input: string): string {
  return input
    .normalize("NFKC")
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase();
}

function normalizeRule(pattern: string, options: RuleOptions): NormalizedRule {
  return {
    raw: pattern,
    normalized: normalizeForMatch(pattern),
    allowPossessive: options.allowPossessive ?? true,
    matchWholeWord: options.matchWholeWord ?? true,
    kind: options.kind ?? "literal",
  };
}
```

## Matching sketch
```ts
function compileRules(rules: NormalizedRule[]) {
  return {
    fastPath: buildLiteralAliasIndex(rules.filter((rule) => rule.kind !== "regex")),
    slowPath: rules.filter((rule) => rule.kind === "regex"),
  };
}

function matchDocument(docText: string, compiled: CompiledRules): MatchHit[] {
  const normalizedDoc = normalizeForMatch(docText);
  const fastHits = compiled.fastPath.scan(normalizedDoc);
  const slowHits = compiled.slowPath.flatMap((rule) => runBoundedRegex(rule, normalizedDoc));
  return postProcessHits([...fastHits, ...slowHits]);
}
```

## Spike plan
- Build a corpus with:
  - capitalization variants
  - possessives
  - short aliases that risk false positives
  - duplicate names across contexts
- Test one active chapter plus a full 200k-word project.
- Compare:
  - naive regex union
  - normalized literal or alias index plus bounded regex fallback
- Record latency and obvious false-positive cases.

## Acceptance criteria
- A normal chapter recompute feels instant enough for typing and rereading.
- A 200k-word project refresh can happen in the background without feeling hostile.
- Possessives, capitalization shifts, and aliases are explainable from the rule model.
- The first implementation path stays simple enough to debug.

## Notes for later pass
- If the fast path is good enough, stop there.
- Do not build search-engine complexity just because large-scale indexing sounds impressive.
