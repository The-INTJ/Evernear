# EXP-003: Lexical Prototype Walkthrough

## Status
Resolved — Lexical not selected

## Date
2026-04-17

## Parent reads
- [FOR_HUMAN_CODE--DOC.md](../../FOR_HUMAN_CODE--DOC.md)
- [FOR_HUMAN_AND_AI_ROADMAP--DOC.md](../../FOR_HUMAN_AND_AI_ROADMAP--DOC.md)
- [src/renderer/editor/README.md](../../src/renderer/editor/README.md)

## Goal
Pressure-test what it would actually feel like to build Evernear's anchor-heavy workflow on Lexical.

## Likely implementation path
1. Create a React editor host with `LexicalComposer`, the prose nodes, and a minimal plugin set.
2. Load the persisted document snapshot into Lexical with `parseEditorState`.
3. Register update listeners and commands so editor changes can flow back to the renderer shell.
4. Derive plain text from the current editor state for matching.
5. Feed match results back into the editor as derived visual state for entity highlights.
6. Add a separate anchor store for slice boundaries and annotations because they should not live as stored visual marks in the document itself.
7. Repair anchors after edits by inspecting changed regions and rerunning custom resolution logic.
8. Render annotation underlines and boundary affordances with custom plugin or node work.
9. Bubble hover and click intents back out to modal and panel controllers.

## Pseudo-code sketch
```tsx
function LexicalDocumentEditor({persistedJson, anchors, matches}: Props) {
  const initialConfig = {
    namespace: "Evernear",
    editorState: persistedJson,
    nodes: proseNodes,
    theme,
    onError(error: Error) {
      throw error;
    },
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <EvernearPersistencePlugin />
      <EvernearDerivedHighlightsPlugin matches={matches} />
      <EvernearAnchorPlugin anchors={anchors} />
      <ContentEditable />
    </LexicalComposer>
  );
}

function EvernearPersistencePlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerUpdateListener(({editorState}) => {
      const contentJson = editorState.toJSON();
      const plainText = editorState.read(() => $getRoot().getTextContent());
      persistSnapshot({contentFormat: "lexical-json", contentJson, plainText});
    });
  }, [editor]);

  return null;
}
```

## What this implies next
- Lexical's serializable editor state is a real advantage.
- The React integration is pleasant.
- The moment Evernear needs shared anchor healing, the implementation starts leaning on custom repair infrastructure that sits beside the editor rather than inside a first-class transaction-mapping model.
- Derived decorations remain possible, but the more boundary and annotation behavior piles up, the more bespoke plugin coordination is required.

## Fit read
- Strengths:
  - lightweight and fast
  - strong React ergonomics
  - serializable editor state
  - commands, listeners, and extensions are good building blocks
- Friction:
  - anchored-range repair feels more custom
  - subtle persistent range visuals are less naturally modeled
  - boundary editing wants infrastructure that is not the editor's obvious happy path

## Provisional verdict
Lexical is viable, but for Evernear it looks like more accidental platform work around anchors, range mapping, and decorations than the product really wants.

## Result
Resolved against Lexical. The anchor-healing, decoration, and history needs that make Evernear Evernear all want a transaction-mapping model inside the editor rather than beside it. See [EXP-004](./EXP-004-prosemirror-prototype-walkthrough.md) for the walkthrough on the chosen side.

## Follow-up
- [ADR-005](../adr/ADR-005-editor-foundation-locked-to-prosemirror.md) records ProseMirror as the locked-in editor foundation.
- This file stays as the memory of why Lexical was not chosen. It should not be deleted.
