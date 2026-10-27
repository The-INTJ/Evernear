import type { Node as ProseMirrorNode } from "prosemirror-model";
import { schema as basicSchema } from "prosemirror-schema-basic";

import type { JsonObject, StoredDocumentSnapshot } from "../../shared/domain/document";
import type {
  ClipboardAuditResult,
  EntityMatchHit,
  MatchingRuleRecord,
  TextAnchor,
} from "../../shared/domain/workspace";
import { buildAnchorFromRange, buildPlainTextIndex } from "../../shared/anchoring";

export type EditorSelectionInfo = {
  from: number;
  to: number;
  empty: boolean;
  text: string;
  anchor?: EditorSelectionAnchor | null;
};

export type EditorSelectionAnchor = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type SerializedTransactionBundle = {
  steps: JsonObject[];
  inverseSteps: JsonObject[];
};

export type VisibleBlockRange = {
  from: number;
  to: number;
};

// `regex` is null when the rule's pattern doesn't compile; such a rule is
// skipped rather than allowed to throw inside the decoration pass.
export type EditorMatchingRule = MatchingRuleRecord & {
  entityName: string;
  regex: RegExp | null;
};

export function buildTextAnchorFromSelection(
  snapshot: StoredDocumentSnapshot,
  selection: EditorSelectionInfo,
): TextAnchor | null {
  if (selection.empty || selection.from >= selection.to) {
    return null;
  }

  const doc = basicSchema.nodeFromJSON(snapshot.contentJson);
  return buildAnchorFromRange(doc, selection.from, selection.to, snapshot.id, snapshot.currentVersion);
}

export function buildClipboardAudit(
  copiedText: string,
  copiedHtml: string,
  persistedPlainText: string,
): ClipboardAuditResult {
  const leakedMarkers = [
    "pm-match-highlight",
    "pm-slice",
    "pm-pending-slice",
    "pm-entity-preview",
    "pm-workbench",
  ].filter((marker) => copiedHtml.includes(marker));

  return {
    copiedText,
    copiedHtml,
    copiedTextMatchesPersistedPlainText: copiedText === persistedPlainText,
    richHtmlPresent: copiedHtml.trim().length > 0,
    leakedWorkbenchMarkup: leakedMarkers.length > 0,
    leakedMarkers,
  };
}

// Rules run against each block's raw text through a character-to-position
// index, so whitespace runs, hard breaks and nested blocks can't shift a
// highlight off the letters that matched.
export function collectMatchesForVisibleBlocks(
  doc: ProseMirrorNode,
  rules: EditorMatchingRule[],
  blocks: VisibleBlockRange[],
): EntityMatchHit[] {
  const hits: EntityMatchHit[] = [];

  for (const block of blocks) {
    const index = buildPlainTextIndex(doc, block.from, block.to, "\n");

    for (const rule of rules) {
      if (!rule.enabled || !rule.regex) {
        continue;
      }

      for (const match of index.text.matchAll(rule.regex)) {
        const matchedText = match[0];
        if (matchedText.length === 0) {
          continue;
        }

        const from = index.charStarts[match.index];
        const to = index.charEnds[match.index + matchedText.length - 1];
        if (from === undefined || to === undefined || from >= to) {
          continue;
        }

        hits.push({
          entityId: rule.entityId,
          entityName: rule.entityName,
          ruleId: rule.id,
          label: rule.label,
          from,
          to,
          matchedText,
        });
      }
    }
  }

  return dedupeMatchHits(hits);
}

function dedupeMatchHits(hits: EntityMatchHit[]): EntityMatchHit[] {
  const seen = new Set<string>();
  const unique: EntityMatchHit[] = [];

  for (const hit of hits) {
    const key = `${hit.ruleId}:${hit.from}:${hit.to}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(hit);
  }

  return unique;
}
