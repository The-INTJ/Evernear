# EXP-002: Live Visible-Range Matching and Rule Normalization

## Status
In progress

## Date
2026-04-17

## Parent reads
- [FOR_HUMAN_AND_AI_ROADMAP--DOC.md](../../FOR_HUMAN_AND_AI_ROADMAP--DOC.md)
- [FOR_HUMAN_CODE--DOC.md](../../FOR_HUMAN_CODE--DOC.md)
- [src/renderer/editor/OPEN_QUESTIONS.md](../../src/renderer/editor/OPEN_QUESTIONS.md)

## Question
Can live visible-range matching stay trustworthy and fast while typing and scrolling, without ever precomputing stored document match sets?

## Why this is load-bearing
Entity-aware reading falls apart if matching is either too noisy, too brittle, or too slow in the exact moment text is on screen.

## Working hypothesis
The practical early pipeline is:

- normalize text and rules in the same way
- keep literal and alias rules on a fast path
- keep regex or exotic rules on a clearly bounded slow path
- compile entity rules when entities change
- derive the visible text range from current layout state
- live-calculate matches only for the visible range when highlighting is enabled
- allow live matching to be disabled while writing

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

function matchVisibleRange(visibleText: string, compiled: CompiledRules): MatchHit[] {
  const normalizedText = normalizeForMatch(visibleText);
  const fastHits = compiled.fastPath.scan(normalizedText);
  const slowHits = compiled.slowPath.flatMap((rule) => runBoundedRegex(rule, normalizedText));
  return postProcessHits([...fastHits, ...slowHits]);
}

function deriveVisibleMatches(state: ViewState) {
  if (!state.highlightingEnabled) {
    return [];
  }

  const visibleText = materializeVisibleText(state.visibleRange);
  return matchVisibleRange(visibleText, state.compiledRules);
}
```

## Spike plan
- Build a corpus with:
  - capitalization variants
  - possessives
  - short aliases that risk false positives
  - duplicate names across contexts
- Test one long chapter and a few extreme viewport sizes.
- Compare:
  - naive regex union over visible text
  - normalized literal or alias index plus bounded regex fallback
- Record latency while typing, scrolling, toggling highlighting, and switching visible spans.
- Confirm that no document-level or project-level match table is introduced.

## Acceptance criteria
- Visible-range recompute feels instant enough for typing and rereading.
- Disabling highlighting cleanly removes matching work from the writing path.
- Possessives, capitalization shifts, and aliases are explainable from the rule model.
- The first implementation path stays simple enough to debug.

## Notes for later pass
- If the fast path is good enough, stop there.
- Do not build precomputed document match tables just because whole-corpus indexing sounds impressive.

## Current workbench implementation
- The workbench now supports literal, alias, and bounded-regex rules in the UI.
- Matching normalizes both rules and visible text with NFKC, apostrophe normalization, whitespace collapse, and lowercase.
- Matching only runs over the current visible block range when overlays are enabled.
- The editor emits visible-range recompute timing so the workbench can record benchmark rows.
- A small scenario runner is implemented for whole-word behavior, possessives, and regex matching.

## Still to learn
- How the visible-range matcher behaves on the real imported manuscript while typing and scrolling.
- Whether short aliases stay trustworthy enough without a more explicit rule compiler.
