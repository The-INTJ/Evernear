# EXP-001: Shared Anchor Substrate Under Live Edits

## Status
In progress

## Date
2026-04-17

## Parent reads
- [FOR_HUMAN_AND_AI_ROADMAP--DOC.md](../../FOR_HUMAN_AND_AI_ROADMAP--DOC.md)
- [FOR_HUMAN_CODE--DOC.md](../../FOR_HUMAN_CODE--DOC.md)
- [src/db/README.md](../../src/db/README.md)
- [src/renderer/features/annotations/README.md](../../src/renderer/features/annotations/README.md)

## Question
Can one anchor-healing model serve both reusable slice boundaries and direct document annotations under normal writing edits?

## Why this is load-bearing
If this fails, both boundary-aware slices and low-noise annotations become fragile.
That would undercut one of Evernear's clearest differentiators and likely force a redesign.

## Working hypothesis
The right model is:

- shared `TextAnchor` payloads for both slice boundaries and annotations
- transaction or change mapping as the first repair step during live editing
- exact-text plus context re-resolution as the fallback when mapping alone is not enough

## Proposed anchor shape
```ts
type TextAnchor = {
  documentId: string;
  from: number;
  to: number;
  exact: string;
  prefix: string;
  suffix: string;
  blockPath: number[];
  approxPlainTextOffset?: number;
  versionSeen: number;
};
```

## Pseudo-code sketch
```ts
function mapAnchorForward(anchor: TextAnchor, changeMap: ChangeMap, nextDoc: Doc): TextAnchor | null {
  const mapped = changeMap.mapRange(anchor.from, anchor.to);
  if (mapped && stillLooksRight(nextDoc, mapped, anchor.exact)) {
    return {...anchor, from: mapped.from, to: mapped.to};
  }

  const repaired = reResolveByExactAndContext(nextDoc, anchor);
  if (repaired) {
    return {...anchor, ...repaired};
  }

  return null;
}

function applyDocumentEdit(nextDoc: Doc, changeMap: ChangeMap, boundaries: TextAnchor[], annotations: TextAnchor[]) {
  return {
    boundaries: boundaries.map((anchor) => mapAnchorForward(anchor, changeMap, nextDoc)).filter(Boolean),
    annotations: annotations.map((anchor) => mapAnchorForward(anchor, changeMap, nextDoc)).filter(Boolean),
  };
}
```

## Spike plan
- Seed a document with several paragraph-spanning slice boundaries.
- Add annotations that overlap, sit adjacent to, and sit inside those boundaries.
- Run edit cases:
  - insert inside range
  - delete inside range
  - insert before range
  - delete across range start or end
  - split paragraph
  - join paragraphs
  - duplicate a paragraph
- Log whether mapping alone works and when fallback re-resolution is needed.

## Acceptance criteria
- Most local edits heal through mapping alone.
- Re-resolution is rare, explainable, and does not jump to obviously wrong duplicate text.
- Slice boundaries and annotations use the same payload and repair path.
- Failure states are detectable instead of silently drifting.

## Notes for later pass
- If this only works cleanly in ProseMirror because of transaction mapping, that is an editor-fit signal, not an implementation detail to ignore.

## Current workbench implementation
- The proof workbench now stores one shared `TextAnchor` payload for boundary and annotation probes.
- Live probe updates map forward through ProseMirror `Mapping` first, then fall back to exact-text plus context re-resolution.
- The workbench surfaces `resolved`, `repaired`, `ambiguous`, and `invalid` states directly in the UI.
- A small scenario runner is implemented for repaired, ambiguous, and invalid outcomes.

## Still to learn
- How this behaves against a real 53k manuscript under repeated structural edits.
- Whether duplicate-text ambiguity remains acceptable once the prose gets much less synthetic.
