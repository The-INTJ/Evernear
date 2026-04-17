# EXP-004: ProseMirror Prototype Walkthrough

## Status
Planned

## Date
2026-04-17

## Parent reads
- [FOR_HUMAN_CODE--DOC.md](../../FOR_HUMAN_CODE--DOC.md)
- [FOR_HUMAN_AND_AI_ROADMAP--DOC.md](../../FOR_HUMAN_AND_AI_ROADMAP--DOC.md)
- [src/renderer/editor/README.md](../../src/renderer/editor/README.md)

## Goal
Pressure-test what it would actually feel like to build Evernear's anchor-heavy workflow on ProseMirror.

## Likely implementation path
1. Define a small prose-first schema.
2. Create an `EditorState` with plugins for persistence, derived highlights, and shared anchors.
3. Load the persisted document JSON into the state.
4. Route every edit through `dispatchTransaction`.
5. Persist full document snapshots plus plain-text projection from the updated state.
6. Store slice boundaries and annotations as shared anchor payloads outside the document.
7. Map those anchors forward with `tr.mapping` during every transaction.
8. Render entity highlights, annotations, and boundary affordances as decorations.
9. Use widget decorations or node views only where boundary handles or richer inline UI truly need them.
10. Bubble hover and click intents from decorations or editor props back to modal and panel controllers.

## Pseudo-code sketch
```ts
const anchorPlugin = new Plugin({
  state: {
    init(_, state) {
      return buildAnchorState(state.doc, initialAnchors);
    },
    apply(tr, anchorState, oldState, newState) {
      return mapAnchorsForward(anchorState, tr.mapping, newState.doc);
    },
  },
  props: {
    decorations(state) {
      return buildEvernearDecorations(state.doc, anchorPlugin.getState(state), currentMatches);
    },
  },
});

const view = new EditorView(host, {
  state: EditorState.create({
    schema,
    doc: schema.nodeFromJSON(persistedJson),
    plugins: [anchorPlugin, persistencePlugin, interactionPlugin],
  }),
  dispatchTransaction(tr) {
    const nextState = view.state.apply(tr);
    view.updateState(nextState);
    persistSnapshot({
      contentFormat: "prosemirror-json",
      contentJson: nextState.doc.toJSON(),
      plainText: nextState.doc.textBetween(0, nextState.doc.content.size, "\n\n"),
    });
  },
});
```

## What this implies next
- ProseMirror is more explicit and more ceremonial at the start.
- That ceremony pays for itself quickly because Evernear already needs transactions, range mapping, plugin state, and decorations.
- Shared anchor healing has a native place to live.
- Quiet annotation underlines and derived highlights both fit the same decoration model.
- External app state and editor state can stay separated without fighting the library.

## Fit read
- Strengths:
  - explicit transactions
  - range mapping already built into the model
  - decorations line up with Evernear's visual needs
  - plugin state keeps editor-local concerns composable
  - node views exist if richer boundary UI is needed later
- Friction:
  - more upfront schema and plugin design
  - less turnkey React comfort than Lexical

## Provisional verdict
ProseMirror is the better fit for Evernear because the core product problems already look like ProseMirror problems: transactions, mapped ranges, decorations, and editor state that can stay honest next to external domain logic.
