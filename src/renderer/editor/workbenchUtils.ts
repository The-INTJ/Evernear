import { Node as ProseMirrorNode } from "prosemirror-model";
import { schema as basicSchema } from "prosemirror-schema-basic";

import type {
  JsonObject,
  StoredDocumentSnapshot,
} from "../../shared/domain/document";
import type {
  ClipboardAuditResult,
  MatchHit,
  MatchingRuleRecord,
  TextAnchor,
} from "../../shared/domain/workbench";

export type EditorSelectionInfo = {
  from: number;
  to: number;
  empty: boolean;
  text: string;
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

export function buildPlainTextIndex(doc: ProseMirrorNode): {
  text: string;
  charStarts: number[];
  charEnds: number[];
} {
  const textParts: string[] = [];
  const charStarts: number[] = [];
  const charEnds: number[] = [];

  doc.forEach((blockNode, offset, index) => {
    const blockStartPos = offset + 1;
    if (index > 0) {
      const separatorPos = blockStartPos - 1;
      for (let i = 0; i < 2; i += 1) {
        textParts.push("\n");
        charStarts.push(separatorPos);
        charEnds.push(separatorPos);
      }
    }

    walkNodeText(blockNode, blockStartPos, textParts, charStarts, charEnds);
  });

  return {
    text: textParts.join(""),
    charStarts,
    charEnds,
  };
}

export function buildClipboardAudit(
  copiedText: string,
  copiedHtml: string,
  persistedPlainText: string,
): ClipboardAuditResult {
  const leakedMarkers = [
    "pm-match-highlight",
    "pm-anchor-boundary",
    "pm-anchor-annotation",
    "pm-anchor-ambiguous",
    "pm-anchor-invalid",
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
  rules: MatchingRuleRecord[],
  blocks: VisibleBlockRange[],
): MatchHit[] {
  const hits: MatchHit[] = [];

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

function resolveBlockPath(doc: ProseMirrorNode, position: number): number[] {
  const resolved = doc.resolve(position);
  const indices: number[] = [];
  for (let depth = 0; depth <= resolved.depth; depth += 1) {
    indices.push(resolved.index(depth));
  }
  return indices;
}

function walkNodeText(
  node: ProseMirrorNode,
  absolutePos: number,
  textParts: string[],
  charStarts: number[],
  charEnds: number[],
): void {
  if (node.isText) {
    const text = node.text ?? "";
    for (let index = 0; index < text.length; index += 1) {
      textParts.push(text[index] ?? "");
      charStarts.push(absolutePos + index);
      charEnds.push(absolutePos + index + 1);
    }
    return;
  }

  node.forEach((child, offset) => {
    walkNodeText(child, absolutePos + offset + 1, textParts, charStarts, charEnds);
  });
}

function dedupeMatchHits(hits: MatchHit[]): MatchHit[] {
  const seen = new Set<string>();
  const unique: MatchHit[] = [];

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
