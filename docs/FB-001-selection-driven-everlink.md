# Feature Brief: Selection-Driven Everlink

## Status
Planned

## Date
2026-04-17

## Problem
Entity and slice authoring is too detached from the moment a writer notices a new person, place, or concept in story text.
If authors have to leave the writing flow to create an entity, choose a lore document, make a slice, and define boundaries manually, the feature turns into bookkeeping instead of re-entry help.

## Desired outcome
Writers can select text in a story document, create or extend the right entity, place the related slice inside a lore document from a persistent panel, and trust that the slice keeps resolving after later edits or even a full re-paste.

## Core flow
1. The writer selects text in a story document. If the exact selection already resolves to a linked entity, the affordance reads `Edit Everlink`; otherwise it reads `Everlink it!`.
2. The chooser opens with the selected text prefilled, offers explicit attach-to-existing-entity behavior, shows recent target documents, and allows creating a new generic document.
3. After the target document is chosen, a persistent panel `DocumentView` opens. The first click creates a pending collapsed slice with temporary colored rails so the author can see where the slice will live.
4. Typing or pasting inside that pending slice expands its range live. If the pending slice is still empty on commit or blur, the original selected text is inserted automatically and becomes the initial slice contents.
5. Later hover preview stays read-only and quick. Slice resolution maps the stored anchor forward first, then repairs by exact text plus context if needed, and surfaces repair instead of wrong lore when the match is ambiguous or gone.

## Data and model touchpoints
- `Entity`, `MatchingRule`, `Slice`, `SliceBoundary`, and `TextAnchor`
- `PendingEverlinkSession` for source selection, chosen entity, target document, pending range, and temporary visual state
- `AnchorResolutionResult` with explicit `resolved`, `ambiguous`, and `invalid` outcomes
- append-only history events for entity creation or update, matching-rule changes, slice creation, slice-boundary creation or update, and entity-slice linking
- a single range-style `TextAnchor` carrying `documentId`, `from`, `to`, `exact`, `prefix`, `suffix`, `blockPath`, `versionSeen`, and optional `approxPlainTextOffset`

## UI surfaces
- selection affordance inside the story editor
- lightweight chooser for entity and target-document decisions
- persistent panel `DocumentView` for target placement and boundary-aware editing
- hover modal for read-only slice preview
- repair or warning surface when anchor resolution is `ambiguous` or `invalid`

## Risks
- The flow could drift toward wiki-style manual linking if manuscript markup ever becomes the truth.
- Duplicate lore text could make repair jump to the wrong place unless anchor resolution fails closed.
- Panel-based placement could feel too disruptive if it steals focus from the story document more than necessary.
- Expanding an existing entity's match scope from selection must stay explicit so aliases or plurals do not silently overmatch.

## Proof
- Exact already-linked selections show `Edit Everlink`, while net-new selections show `Everlink it!`.
- Explicit attach-to-existing-entity expands matching rules instead of creating a hidden one-off link.
- Pending slice rails appear on first click in the target document and track typing, paste, deletion, and multiline edits.
- Empty pending slices auto-fill from the source selection only on commit or blur.
- Normal edits heal through mapping alone, while larger edits and re-paste paths repair through exact text plus context.
- Ambiguous or missing anchors never preview the wrong slice.
