// Matching rules are regular expressions (ADR-008). A pattern is either a
// bare regex, matched ignoring case, or a /slash/ form whose flags the
// author controls: `/\bWill\b/` matches "Will" but not "will".
//
// JavaScript's `\b` only knows ASCII word characters, so `\bÉowyn\b` never
// matches " Éowyn". Unescaped `\b` and `\B` outside character classes are
// rewritten to Unicode-aware edges before compiling, which keeps the
// patterns authors read and write short.

const WORD_CHAR = "[\\p{L}\\p{N}_]";
const WORD_EDGE = `(?:(?<=${WORD_CHAR})(?!${WORD_CHAR})|(?<!${WORD_CHAR})(?=${WORD_CHAR}))`;
const NOT_WORD_EDGE = `(?:(?<=${WORD_CHAR})(?=${WORD_CHAR})|(?<!${WORD_CHAR})(?!${WORD_CHAR}))`;
const SLASH_FORM = /^\/(.+)\/([a-z]*)$/s;
const AUTHOR_FLAGS = new Set(["i", "m", "s"]);
const WORD_CHAR_TEST = /[\p{L}\p{N}_]/u;

export type CompiledPattern =
  | { ok: true; regex: RegExp }
  | { ok: false; error: string };

export function compileMatchingPattern(pattern: string): CompiledPattern {
  if (pattern.trim().length === 0) {
    return { ok: false, error: "The pattern is empty." };
  }

  const slashForm = SLASH_FORM.exec(pattern);
  const source = slashForm ? slashForm[1]! : pattern;
  const authorFlags = slashForm ? slashForm[2]!.replace(/[gu]/g, "") : "i";
  for (const flag of authorFlags) {
    if (!AUTHOR_FLAGS.has(flag)) {
      return { ok: false, error: `Flag "${flag}" isn't supported. Use i, m or s.` };
    }
  }

  try {
    return { ok: true, regex: new RegExp(rewriteWordEdges(source), `g${authorFlags}u`) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message.replace(/^Invalid regular expression: \/.*\/[a-z]*: /s, "") };
  }
}

// The regex for an exact phrase as authors write it: special characters
// escaped, any run of whitespace allowed between words, straight and curly
// apostrophes interchangeable, and word edges only where the phrase
// starts or ends with a word character.
export function patternFromText(text: string, wholeWord = true): string {
  const trimmed = text.trim();
  const body = trimmed
    .split(/\s+/)
    .map((word) => Array.from(word, escapePatternCharacter).join(""))
    .join("\\s+");
  const leadingEdge = wholeWord && WORD_CHAR_TEST.test(trimmed.charAt(0)) ? "\\b" : "";
  const trailingEdge = wholeWord && WORD_CHAR_TEST.test(trimmed.charAt(trimmed.length - 1)) ? "\\b" : "";
  return `${leadingEdge}${body}${trailingEdge}`;
}

// matchAll leaves the shared regex's lastIndex alone; exec and test would
// not, so callers holding a compiled rule must only go through matchAll.
export function patternMatchesWholeText(regex: RegExp, text: string): boolean {
  for (const match of text.matchAll(regex)) {
    if (match.index === 0 && match[0].length === text.length) {
      return true;
    }
  }
  return false;
}

function escapePatternCharacter(character: string): string {
  if (character === "'" || character === "’") {
    return "['’]";
  }
  return /[\\^$.*+?()[\]{}|/]/.test(character) ? `\\${character}` : character;
}

function rewriteWordEdges(source: string): string {
  let output = "";
  let inCharacterClass = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]!;
    if (character === "\\" && index + 1 < source.length) {
      const next = source[index + 1]!;
      if (!inCharacterClass && next === "b") {
        output += WORD_EDGE;
      } else if (!inCharacterClass && next === "B") {
        output += NOT_WORD_EDGE;
      } else {
        output += character + next;
      }
      index += 1;
      continue;
    }
    if (character === "[") {
      inCharacterClass = true;
    } else if (character === "]") {
      inCharacterClass = false;
    }
    output += character;
  }
  return output;
}
