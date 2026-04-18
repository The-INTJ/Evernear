// Small formatting helpers for renderer use. Pure functions, no React.

export function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatBoundaryReason(reason: string): string {
  return reason.length > 0 ? reason : "Boundary resolution not yet captured";
}

export function countForLabel(currentCount: number): number {
  return currentCount + 1;
}

export function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function stringifyError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
}
