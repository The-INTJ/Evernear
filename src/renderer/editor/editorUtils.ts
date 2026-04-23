import { schema as basicSchema } from "prosemirror-schema-basic";

import type { JsonObject, StoredDocumentSnapshot } from "../../shared/domain/document";
import type {
  ClipboardAuditResult,
  EntityMatchHit,
  MatchingRuleRecord,
  TextAnchor,
} from "../../shared/domain/workspace";
import { buildPlainTextIndex, resolveBlockPath } from "../../shared/anchoring";

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
  text: string;
};

export type EditorMatchingRule = MatchingRuleRecord & {
  entityName: string;
};

export function buildTextAnchorFromSelection(
  snapshot: StoredDocumentSnapshot,
  selection: EditorSelectionInfo,
): TextAnchor | null {
  if (selection.empty || selection.from >= selection.to) {
    return null;
  }

  const doc = basicSchema.nodeFromJSON(snapshot.contentJson);
  const index = buildPlainTextIndex(doc);
  const exact = doc.textBetween(selection.from, selection.to, "\n\n");

  return {
    documentId: snapshot.id,
    from: selection.from,
    to: selection.to,
    exact,
    prefix: doc.textBetween(Math.max(1, selection.from - 24), selection.from, "\n\n"),
    suffix: doc.textBetween(selection.to, Math.min(doc.content.size, selection.to + 24), "\n\n"),
    blockPath: resolveBlockPath(doc, selection.from),
    approxPlainTextOffset: index.text.indexOf(exact),
    versionSeen: snapshot.currentVersion,
  };
}

export function buildClipboardAudit(
  copiedText: string,
  copiedHtml: string,
  persistedPlainText: string,
): ClipboardAuditResult {
  const leakedMarkers = [
    "pm-match-highlight",
    "pm-slice-boundary",
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

export function collectMatchesForVisibleBlocks(
  rules: EditorMatchingRule[],
  blocks: VisibleBlockRange[],
): EntityMatchHit[] {
  const hits: EntityMatchHit[] = [];

  for (const block of blocks) {
    const normalizedText = normalizeForMatch(block.text);

    for (const rule of rules) {
      if (!rule.enabled) {
        continue;
      }

      if (rule.kind === "regex") {
        const regex = new RegExp(rule.pattern, "giu");
        for (const match of block.text.matchAll(regex)) {
          const matchedText = match[0] ?? "";
          const matchIndex = match.index ?? -1;
          if (matchIndex < 0 || matchedText.length === 0) {
            continue;
          }

          hits.push({
            entityId: rule.entityId,
            entityName: rule.entityName,
            ruleId: rule.id,
            label: rule.label,
            from: block.from + matchIndex,
            to: block.from + matchIndex + matchedText.length,
            matchedText,
            normalizedText: normalizeForMatch(matchedText),
          });
        }
        continue;
      }

      const normalizedRule = normalizeForMatch(rule.pattern);
      let searchIndex = 0;
      while (searchIndex < normalizedText.length) {
        const foundAt = normalizedText.indexOf(normalizedRule, searchIndex);
        if (foundAt === -1) {
          break;
        }

        const before = normalizedText[foundAt - 1] ?? " ";
        const after = normalizedText[foundAt + normalizedRule.length] ?? " ";
        const suffix = normalizedText.slice(foundAt + normalizedRule.length, foundAt + normalizedRule.length + 2);
        const wholeWordOkay = !rule.wholeWord || (!isWordCharacter(before) && !isWordCharacter(after));
        const possessiveOkay = !rule.allowPossessive || suffix === "'s" || suffix === "" || !isWordCharacter(after);

        if (wholeWordOkay && possessiveOkay) {
          hits.push({
            entityId: rule.entityId,
            entityName: rule.entityName,
            ruleId: rule.id,
            label: rule.label,
            from: block.from + foundAt,
            to: block.from + foundAt + rule.pattern.length,
            matchedText: block.text.slice(foundAt, foundAt + rule.pattern.length),
            normalizedText: normalizedRule,
          });
        }

        searchIndex = foundAt + Math.max(1, normalizedRule.length);
      }
    }
  }

  return dedupeMatchHits(hits);
}

export function normalizeForMatch(input: string): string {
  return input
    .normalize("NFKC")
    .replace(/[\u2019']/g, "'")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase();
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

function isWordCharacter(character: string): boolean {
  return /[\p{L}\p{N}_]/u.test(character);
}
