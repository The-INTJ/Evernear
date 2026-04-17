# Shared Domain

## Status
MVP now

## If you landed here first
Read [FOR_HUMAN_CODE--DOC.md](../../../FOR_HUMAN_CODE--DOC.md) first. This folder is the canonical vocabulary for the app, so upstream context matters.

## Parent reads
- [src/shared/README.md](../README.md)
- [FOR_HUMAN_CODE--DOC.md](../../../FOR_HUMAN_CODE--DOC.md)
- [FOR_HUMAN_BUSINESS--DOC.md](../../../FOR_HUMAN_BUSINESS--DOC.md)

## Owns
- The stable names and meanings of core concepts.
- Shared type surfaces that should remain readable across runtimes.

## Does not own
- SQL schema details.
- UI interaction policy.
- Electron-specific code.

## Canonical concepts
| Concept | Why it exists | Notes |
| --- | --- | --- |
| `Project` | groups one story workspace | local-first, single-user-first |
| `DocumentFolder` | groups documents for lightweight project organization | organization-only, not semantic meaning |
| `Document` | holds editable prose content | stays generic early; story and reference both fit here |
| `DocumentOutlineNode` | marks a navigable place inside one document | anchored metadata, not a separate document |
| `Entity` | defines semantic meaning that can be detected in text and open related context | owns a list of matching rules and a library of slices; it is not visual |
| `MatchingRule` | describes one thing an entity should match in text | can be literal, alias-based, or pattern-based |
| `TextAnchor` | gives the app a durable way to find a range again after edits | shared substrate for slice boundaries and annotations; stores exact text, local context, and optional coarse jump hints |
| `TextTransferProvenance` | reserves a future seam for copy or move operations that preserve slice meaning | not required for ordinary paste behavior |
| `Slice` | references a bounded relevant region, whole document, or later another asset | does not own content |
| `SliceBoundary` | captures a reusable anchored range inside a document | multiple slices may share one boundary |
| `Annotation` | captures low-noise personal notes | direct document anchors, not collaborative review comments |
| `Highlight` | provides the visual effect of a match in text | derived, never stored |
| `PendingEverlinkSession` | carries one selection-driven Everlink authoring flow through the renderer | temporary state for source selection, chosen entity, target document, and pending slice range |
| `AnchorResolutionResult` | says whether a stored anchor resolves cleanly against current text | should fail closed as `ambiguous` or `invalid` rather than jump to the wrong span |
| `ProjectNavNode` | unified tree item used by the renderer for folder, document, or outline navigation | view model, not a separate persisted concept |
| `SliceViewer` | shows the slices associated with an entity | shared by modal and panel surfaces |
| `Modal` | handles temporary hover preview | disappears on mouse exit |
| `Panel` | handles persistent expanded context | can open a deeper document view |
| `DocumentView` | shows a full document from a slice within a panel | boundary-aware editing and navigation live here |
| `Panel/LayoutState` | remembers how context stays visible | supports re-entry and flow |

## Key relationships
- `DocumentFolder` and `DocumentOutlineNode` organize navigation and re-entry, but they do not replace semantic modeling through `Entity` and `Slice`.
- `db/schema` should map to these concepts without distorting the many-to-many `Entity` to `Slice` relationship.
- `SliceBoundary`, `Annotation`, and later `DocumentOutlineNode` should share the same `TextAnchor` payload shape even if they persist in different tables.
- Selection-driven `Everlink it!` authoring may start from a manual selection, but the resulting truth still belongs to `Entity`, `MatchingRule`, `Slice`, and `SliceBoundary`, not to stored document markup.
- `ProjectNavNode` should be derived from folders, documents, and outline nodes rather than becoming its own storage truth.
- Match results are derived live from current text and should not become stored rows.
- `renderer/features` should consume these names directly rather than invent local synonyms.

## Decided
- These names are the shared vocabulary to build around unless a stronger term emerges.
- The first organization model is folders plus generic documents.
- Copying text out should stay clean even when the editor is rendering derived visuals.

## Open
- Exact outline-node authoring and navigation workflow once anchored document structure lands.
- Exact matching-rule richness in the first implementation.

## Deferred
- Binder-style manuscript tooling beyond lightweight folders and outline nodes.
- Graph-style relationship modeling beyond the slices needed for the core workflow.
