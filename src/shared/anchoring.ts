// Pure anchor math over ProseMirror documents. No DB access, no mutation,
// no domain knowledge beyond TextAnchor / AnchorResolutionResult. Lives in
// `shared/` so both the DB layer (boundary repair after each step) and the
// renderer (building anchors from user selections) pull from one source.
//
// This is the load-bearing algorithm behind slice boundary survival across
// edits. Everything in here is deterministic and unit-testable; keep it that
// way. If you need repo state, wrap these functions somewhere else — don't
// pull repository concerns down here.
//
// See docs/adr/adr-index.html#docs-adr-adr-006-event-sourced-document-and-metadata-history and FOR_HUMAN_CODE--DOC.html for the anchor contract.

import type { Node as ProseMirrorNode } from "prosemirror-model";
import { schema as basicSchema } from "prosemirror-schema-basic";
import { Mapping, Step } from "prosemirror-transform";

import type { JsonObject } from "./domain/document";
import type {
  AnchorResolutionResult,
  AnchorResolutionStatus,
  TextAnchor,
} from "./domain/workspace";

export type PlainTextIndex = {
  text: string;
  charStarts: number[];
  charEnds: number[];
};

// When two candidate matches score within this distance of each other, the
// resolver fails closed to `ambiguous` rather than guessing — context
// (prefix/suffix/proximity) wasn't strong enough to pick a unique winner.
// Tuned against the test cases in anchoring.test.ts; lowering it makes the
// resolver more aggressive (more "repaired", fewer "ambiguous"), raising
// it makes it more conservative.
export const FUZZY_MATCH_AMBIGUITY_THRESHOLD = 0.25;

export function createMappingFromSteps(serializedSteps: JsonObject[]): Mapping {
  const mapping = new Mapping();
  for (const serializedStep of serializedSteps) {
    const step = Step.fromJSON(basicSchema, serializedStep);
    mapping.appendMap(step.getMap());
  }
  return mapping;
}

export function mapBoundaryForward(
  anchor: TextAnchor,
  previousStatus: AnchorResolutionStatus,
  mapping: Mapping,
  nextDoc: ProseMirrorNode,
  nextVersion: number,
  index: PlainTextIndex = buildPlainTextIndex(nextDoc),
): AnchorResolutionResult {
  // An invalid or ambiguous anchor still holds positions from the last
  // version where it resolved. Mapping those through later steps lands on
  // whatever text sits there now, so only exact text plus context may
  // bring it back.
  if (previousStatus === "invalid" || previousStatus === "ambiguous") {
    return resolveAnchorWithFallback(
      anchor,
      nextDoc,
      "slice was unresolved before this edit",
      nextVersion,
      index,
    );
  }

  // `to` uses +1 so text inserted at the tail of a slice stays inside the
  // slice — writing at the trailing boundary should grow it, not escape it.
  // `from` stays +1 so text typed immediately before a slice stays outside.
  const mappedFrom = mapping.map(anchor.from, 1);
  const mappedTo = mapping.map(anchor.to, 1);

  if (mappedFrom < mappedTo) {
    const mappedExact = nextDoc.textBetween(mappedFrom, mappedTo, "\n\n");
    const nextAnchor = buildAnchorFromRange(nextDoc, mappedFrom, mappedTo, anchor.documentId, nextVersion, index);
    return {
      status: "resolved",
      reason: mappedExact === anchor.exact
        ? "slice boundary mapped forward through document steps"
        : "slice boundary absorbed edits inside the tracked range",
      anchor: nextAnchor,
    };
  }

  return resolveAnchorWithFallback(
    anchor,
    nextDoc,
    "slice boundary mapping no longer matched exact text",
    nextVersion,
    index,
  );
}

export function resolveAnchorWithFallback(
  anchor: TextAnchor,
  nextDoc: ProseMirrorNode,
  fallbackReason: string,
  nextVersion: number,
  index: PlainTextIndex = buildPlainTextIndex(nextDoc),
): AnchorResolutionResult {
  const exact = anchor.exact;
  const candidates: Array<{ startOffset: number; score: number }> = [];

  let searchIndex = 0;
  while (searchIndex <= index.text.length) {
    const foundAt = index.text.indexOf(exact, searchIndex);
    if (foundAt === -1) {
      break;
    }

    const prefixSlice = index.text.slice(Math.max(0, foundAt - anchor.prefix.length), foundAt);
    const suffixSlice = index.text.slice(foundAt + exact.length, foundAt + exact.length + anchor.suffix.length);
    const prefixMatch = anchor.prefix.length === 0 || prefixSlice.endsWith(anchor.prefix);
    const suffixMatch = anchor.suffix.length === 0 || suffixSlice.startsWith(anchor.suffix);
    const proximityScore = anchor.approxPlainTextOffset === undefined
      ? 0
      : Math.max(0, 50 - Math.abs(foundAt - anchor.approxPlainTextOffset)) / 100;

    candidates.push({
      startOffset: foundAt,
      score: (prefixMatch ? 3 : 0) + (suffixMatch ? 3 : 0) + proximityScore,
    });
    searchIndex = foundAt + Math.max(1, exact.length);
  }

  if (candidates.length === 0) {
    return {
      status: "invalid",
      reason: `${fallbackReason}; exact text no longer exists`,
      anchor,
    };
  }

  candidates.sort((left, right) => right.score - left.score);
  const best = candidates[0]!;
  const second = candidates[1];

  if (second && Math.abs(best.score - second.score) < FUZZY_MATCH_AMBIGUITY_THRESHOLD) {
    return {
      status: "ambiguous",
      reason: `${fallbackReason}; multiple plausible matches remained`,
      anchor,
    };
  }

  const from = offsetToPosition(index, best.startOffset);
  const to = offsetToPosition(index, best.startOffset + Math.max(exact.length - 1, 0), true);
  if (from === null || to === null || from >= to) {
    return {
      status: "invalid",
      reason: `${fallbackReason}; could not map repaired text back to document positions`,
      anchor,
    };
  }

  return {
    status: "repaired",
    reason: `${fallbackReason}; exact text plus context repaired the range`,
    anchor: buildAnchorFromRange(nextDoc, from, to, anchor.documentId, nextVersion, index),
  };
}

// Mirrors `doc.textBetween(from, to, "\n\n", leafText)` character for
// character and records the document position of each character, so an
// offset found by searching `text` maps straight back to positions. That
// equality is what lets an anchor's `exact` (built with textBetween) be
// found again in nested blocks such as block quotes. Block separators have
// no width in the document, so both ends point at the block boundary.
// The anchor substrate keeps the default empty `leafText`; entity matching
// passes "\n" so a hard break still separates the words on either side.
export function buildPlainTextIndex(
  doc: ProseMirrorNode,
  from = 0,
  to = doc.content.size,
  leafText = "",
): PlainTextIndex {
  const textParts: string[] = [];
  const charStarts: number[] = [];
  const charEnds: number[] = [];
  let first = true;

  doc.nodesBetween(from, to, (node, pos) => {
    const nodeText = node.isText
      ? (node.text ?? "").slice(Math.max(from, pos) - pos, to - pos)
      : !node.isLeaf
        ? ""
        : leafText || (node.type.spec.leafText ? node.type.spec.leafText(node) : "");

    if (node.isBlock && ((node.isLeaf && nodeText) || node.isTextblock)) {
      if (first) {
        first = false;
      } else {
        textParts.push("\n", "\n");
        charStarts.push(pos, pos);
        charEnds.push(pos, pos);
      }
    }

    const start = node.isText ? Math.max(from, pos) : pos;
    for (let offset = 0; offset < nodeText.length; offset += 1) {
      textParts.push(nodeText[offset]!);
      charStarts.push(node.isText ? start + offset : pos);
      charEnds.push(node.isText ? start + offset + 1 : pos + node.nodeSize);
    }
  });

  return {
    text: textParts.join(""),
    charStarts,
    charEnds,
  };
}

// Plain-text offset of the first character at or after `position`.
export function plainOffsetAtPosition(index: PlainTextIndex, position: number): number {
  const offset = index.charStarts.findIndex((start) => start >= position);
  return offset === -1 ? index.charStarts.length : offset;
}

export function offsetToPosition(
  index: PlainTextIndex,
  plainOffset: number,
  useEnd = false,
): number | null {
  if (plainOffset < 0) {
    return null;
  }

  if (plainOffset >= index.charStarts.length) {
    const finalEnd = index.charEnds[index.charEnds.length - 1];
    return finalEnd ?? null;
  }

  return useEnd ? index.charEnds[plainOffset] ?? null : index.charStarts[plainOffset] ?? null;
}

export function buildAnchorFromRange(
  doc: ProseMirrorNode,
  from: number,
  to: number,
  documentId: string,
  versionSeen: number,
  index: PlainTextIndex = buildPlainTextIndex(doc),
): TextAnchor {
  const exact = doc.textBetween(from, to, "\n\n");
  const prefix = doc.textBetween(Math.max(1, from - 24), from, "\n\n");
  const suffix = doc.textBetween(to, Math.min(doc.content.size, to + 24), "\n\n");
  return {
    documentId,
    from,
    to,
    exact,
    prefix,
    suffix,
    blockPath: resolveBlockPath(doc, from),
    approxPlainTextOffset: plainOffsetAtPosition(index, from),
    versionSeen,
  };
}

export function resolveBlockPath(doc: ProseMirrorNode, position: number): number[] {
  const resolved = doc.resolve(position);
  const indices: number[] = [];
  for (let depth = 0; depth <= resolved.depth; depth += 1) {
    indices.push(resolved.index(depth));
  }
  return indices;
}

export function serializeNodePlainText(doc: ProseMirrorNode): string {
  return doc.textBetween(0, doc.content.size, "\n\n");
}
