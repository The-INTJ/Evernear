// Pure utilities for the DB layer — no DB, no domain knowledge.
// Intentionally tiny. Add new helpers here only if they're used across
// repositories; feature-specific helpers belong with the feature.

export function boolToInt(value: boolean): number {
  return value ? 1 : 0;
}

export function intToBool(value: number): boolean {
  return value === 1;
}

export function isoNow(): string {
  return new Date().toISOString();
}

export function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

export function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function safeParseStringArray(serialized: string, fallback: string[]): string[] {
  try {
    const parsed = JSON.parse(serialized) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : fallback;
  } catch {
    return fallback;
  }
}

// Used for equality checks on structured payloads (e.g. anchor JSON diffs
// inside updateSliceBoundariesForDocument). Key-sorted so shape changes,
// not field order, drive "did this change?" decisions.
export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, nested) => {
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      return Object.fromEntries(
        Object.entries(nested as Record<string, unknown>).sort(([l], [r]) => l.localeCompare(r)),
      );
    }
    return nested;
  });
}
