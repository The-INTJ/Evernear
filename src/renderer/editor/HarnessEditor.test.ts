// Clipboard prose-only invariant. From the Product Guide:
//   "Ctrl+A / Ctrl+C must yield prose, not decorations or editor chrome.
//    Derived highlights and annotation underlines live in ProseMirror
//    Decoration, never in the document model."
//
// This is a load-bearing non-negotiable. The renderer guarantees it in
// two places:
//
//   1. clipboardTextSerializer is wired to a function that returns
//      Slice.content.textBetween — no HTML, no marks, no attributes.
//      A future change that swapped this for a richer serializer would
//      silently leak workbench markup into the clipboard.
//
//   2. buildClipboardAudit (workbenchUtils) scans copied HTML for the
//      known leaky class-name markers (pm-match-highlight,
//      pm-slice-boundary, etc.) and surfaces them to dev-mode harnesses.
//      A future change that dropped a marker from the audit list would
//      blind the dev-mode regression check.
//
// We can't mount HarnessEditor in a node-environment test (prosemirror-view
// needs the DOM). Instead we assert the contract on three layers:
//   - source text (the wiring is the prose-only function, not an HTML
//     serializer);
//   - the ProseMirror primitive Slice.content.textBetween, with marks
//     applied, returns clean text (the trust assumption underneath);
//   - buildClipboardAudit flags every leaky marker we know about.

import path from "node:path";
import { readFileSync } from "node:fs";

import { Fragment, Mark, Node as ProseMirrorNode, Slice } from "prosemirror-model";
import { schema as basicSchema } from "prosemirror-schema-basic";
import { describe, expect, it } from "vitest";

import { buildClipboardAudit } from "./workbenchUtils";

const repoRoot = path.resolve(__dirname, "..", "..", "..");
const harnessEditorSource = readFileSync(
  path.join(repoRoot, "src", "renderer", "editor", "HarnessEditor.tsx"),
  "utf8",
);

describe("HarnessEditor clipboardTextSerializer wiring", () => {
  it("sets clipboardTextSerializer to the prose-only serializeSlicePlainText function", () => {
    // The exact configured serializer name is what gets called when the
    // user copies. Any change here is intentional and worth a test update.
    expect(harnessEditorSource).toMatch(/clipboardTextSerializer:\s*serializeSlicePlainText/);
  });

  it("serializeSlicePlainText body is a textBetween call (no HTML serialization)", () => {
    // Lock the implementation shape: no DOMSerializer, no innerHTML, no
    // attribute reads. Anything richer would be a regression toward the
    // old "copy includes decorations" bug.
    const fnMatch = harnessEditorSource.match(
      /function serializeSlicePlainText\(slice: Slice\): string \{([\s\S]*?)\n\}/,
    );
    expect(fnMatch, "serializeSlicePlainText should exist as a top-level function").not.toBeNull();
    const body = fnMatch![1]!;
    expect(body).toContain("textBetween");
    expect(body).not.toContain("DOMSerializer");
    expect(body).not.toContain("innerHTML");
    expect(body).not.toContain("toJSON");
  });

  it("does not register any rich clipboardSerializer override", () => {
    // PM accepts a `clipboardSerializer` (HTML) field on EditorProps. The
    // editor MUST NOT set one — we rely on PM's default DOMSerializer
    // for the HTML clipboard, and on serializeSlicePlainText for text.
    expect(harnessEditorSource).not.toMatch(/clipboardSerializer:/);
  });
});

describe("ProseMirror Slice.content.textBetween (the underlying primitive)", () => {
  // serializeSlicePlainText is a one-liner around this primitive. Verify
  // the primitive itself doesn't leak marks or attributes — that is what
  // the editor's text clipboard relies on.
  it("returns plain text with no mark serialization for a marked slice", () => {
    const strongMark = basicSchema.marks.strong!.create();
    const emMark = basicSchema.marks.em!.create();
    const textNode: ProseMirrorNode = basicSchema.text("Hello", [strongMark, emMark]);
    const para = basicSchema.nodes.paragraph!.create({}, textNode);
    const slice = new Slice(Fragment.from(para), 0, 0);

    const out = slice.content.textBetween(0, slice.content.size, "\n\n");
    expect(out).toBe("Hello");
    // No mark names, no class hints, no HTML.
    expect(out).not.toMatch(/<|>|class=|data-/);
  });

  it("joins block boundaries with the configured separator and nothing else", () => {
    const para1 = basicSchema.nodes.paragraph!.create({}, basicSchema.text("First"));
    const para2 = basicSchema.nodes.paragraph!.create({}, basicSchema.text("Second"));
    const slice = new Slice(Fragment.fromArray([para1, para2]), 0, 0);

    const out = slice.content.textBetween(0, slice.content.size, "\n\n");
    expect(out).toBe("First\n\nSecond");
  });

  it("ignores attributes on nodes (decorations live outside the doc model entirely)", () => {
    // No basicSchema node carries attribute-shaped state we care about,
    // but the principle is: textBetween reads .text on text nodes and
    // recursive .descendants — never .attrs. This test pins that property
    // by adding marks (the closest thing schema-basic has) and asserting
    // the output is identical to a mark-free version.
    const link = basicSchema.marks.link!.create({ href: "https://example.com" });
    const linked = basicSchema.text("click", [link]);
    const para = basicSchema.nodes.paragraph!.create({}, linked);
    const slice = new Slice(Fragment.from(para), 0, 0);

    const out = slice.content.textBetween(0, slice.content.size, "\n\n");
    expect(out).toBe("click");
    expect(out).not.toContain("https://example.com");
    expect(out).not.toContain("href");
  });

  // Suppress unused import warning; Mark is loaded for clarity in test
  // construction even though we use the schema's mark-create helpers.
  it("imports Mark for clarity (compile-time check)", () => {
    expect(typeof Mark).toBe("function");
  });
});

describe("buildClipboardAudit", () => {
  const PERSISTED_PLAIN = "Hello world";

  it("flags HTML containing pm-match-highlight as a workbench leak", () => {
    const html = '<p><span class="pm-match-highlight">Hello</span> world</p>';
    const audit = buildClipboardAudit("Hello world", html, PERSISTED_PLAIN);
    expect(audit.leakedWorkbenchMarkup).toBe(true);
    expect(audit.leakedMarkers).toContain("pm-match-highlight");
  });

  it("flags HTML containing pm-slice-boundary as a workbench leak", () => {
    const html = '<p><span class="pm-slice-boundary">Hello</span> world</p>';
    const audit = buildClipboardAudit("Hello world", html, PERSISTED_PLAIN);
    expect(audit.leakedMarkers).toContain("pm-slice-boundary");
  });

  it("flags every marker present and lists no false positives", () => {
    const html = '<div class="pm-pending-slice pm-entity-preview pm-workbench">x</div>';
    const audit = buildClipboardAudit("x", html, "x");
    expect(audit.leakedMarkers.sort()).toEqual([
      "pm-entity-preview",
      "pm-pending-slice",
      "pm-workbench",
    ]);
  });

  it("returns leakedWorkbenchMarkup=false when HTML contains only prose", () => {
    const html = "<p>Hello world</p>";
    const audit = buildClipboardAudit("Hello world", html, PERSISTED_PLAIN);
    expect(audit.leakedWorkbenchMarkup).toBe(false);
    expect(audit.leakedMarkers).toEqual([]);
    expect(audit.copiedTextMatchesPersistedPlainText).toBe(true);
    expect(audit.richHtmlPresent).toBe(true);
  });

  it("flags a mismatch between copied plain text and persisted plain text", () => {
    const audit = buildClipboardAudit("Hello WORLD", "<p>Hello WORLD</p>", PERSISTED_PLAIN);
    expect(audit.copiedTextMatchesPersistedPlainText).toBe(false);
  });

  it("treats whitespace-only HTML as 'no rich clipboard' (regression: empty paste audit)", () => {
    const audit = buildClipboardAudit("Hello world", "   \n  ", PERSISTED_PLAIN);
    expect(audit.richHtmlPresent).toBe(false);
  });
});
