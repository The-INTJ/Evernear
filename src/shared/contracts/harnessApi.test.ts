// IPC contract symmetry. The HARNESS_CHANNELS catalog, the HarnessBridge
// interface, the Zod input validators, and the ipcMain.handle registrations
// in main/setupIpcHandlers.ts all need to stay in lock-step. TypeScript
// catches some of this at compile time but not all of it (interfaces erase
// at runtime, schemas live in a parallel const, channel constants are strings
// the compiler does not cross-check against handler registrations).
//
// These tests parse the relevant files as text rather than importing them.
// Importing the main-process sources pulls Electron into the test environment,
// and we don't want to spin up the app to verify handler-name parity.

import path from "node:path";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { HARNESS_CHANNELS } from "./harnessApi";

const repoRoot = path.resolve(__dirname, "..", "..", "..");
const harnessApiSource = readFileSync(path.join(repoRoot, "src", "shared", "contracts", "harnessApi.ts"), "utf8");
const harnessSchemasSource = readFileSync(path.join(repoRoot, "src", "shared", "contracts", "harnessSchemas.ts"), "utf8");
const setupIpcHandlersSource = readFileSync(path.join(repoRoot, "src", "main", "setupIpcHandlers.ts"), "utf8");

// Channels whose handler is a getter or otherwise takes no validated input
// payload (and therefore intentionally has no Zod schema in harnessSchemas).
const SCHEMA_EXEMPT_CHANNELS = new Set([
  "getStatus",
  "loadWorkspace",
  "writeCheckpoint",
  "replayDocumentToVersion",
  "readClipboardText",
  "readClipboardHtml",
  "clearClipboard",
]);

describe("HARNESS_CHANNELS catalog", () => {
  it("declares unique channel values across the surface", () => {
    const values = Object.values(HARNESS_CHANNELS);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });

  it("uses the workspace: namespace for every channel value", () => {
    for (const value of Object.values(HARNESS_CHANNELS)) {
      expect(value.startsWith("workspace:")).toBe(true);
    }
  });
});

describe("HarnessBridge interface symmetry", () => {
  // The interface body is the source of truth for which methods preload
  // forwards. Keep it aligned with HARNESS_CHANNELS.
  const bridgeMethodNames = extractBridgeMethodNames(harnessApiSource);

  it("declares one HarnessBridge method per HARNESS_CHANNELS key", () => {
    for (const channelKey of Object.keys(HARNESS_CHANNELS)) {
      expect(bridgeMethodNames.has(channelKey)).toBe(true);
    }
  });

  it("does not declare HarnessBridge methods that are missing from HARNESS_CHANNELS", () => {
    for (const methodName of bridgeMethodNames) {
      expect(Object.prototype.hasOwnProperty.call(HARNESS_CHANNELS, methodName)).toBe(true);
    }
  });
});

describe("ipcMain.handle registrations in src/main/setupIpcHandlers.ts", () => {
  it("registers an ipcMain.handle for every HARNESS_CHANNELS key", () => {
    for (const channelKey of Object.keys(HARNESS_CHANNELS)) {
      const pattern = new RegExp(`ipcMain\\.handle\\(\\s*C\\.${channelKey}\\b`);
      expect(pattern.test(setupIpcHandlersSource)).toBe(true);
    }
  });
});

describe("Zod schemas in src/shared/contracts/harnessSchemas.ts", () => {
  it("exports a *InputSchema for every non-exempt HARNESS_CHANNELS key", () => {
    for (const channelKey of Object.keys(HARNESS_CHANNELS)) {
      if (SCHEMA_EXEMPT_CHANNELS.has(channelKey)) continue;
      const expected = `${channelKey[0]!.toUpperCase()}${channelKey.slice(1)}InputSchema`;
      const pattern = new RegExp(`export const ${expected}\\b`);
      expect(pattern.test(harnessSchemasSource)).toBe(true);
    }
  });
});

function extractBridgeMethodNames(source: string): Set<string> {
  // Slice out the body of `export interface HarnessBridge { ... }` so we
  // don't accidentally pick up unrelated method-signature lines elsewhere
  // in the file (e.g. ClipboardAuditBridge below).
  const start = source.indexOf("export interface HarnessBridge");
  if (start === -1) {
    throw new Error("HarnessBridge interface not found in harnessApi.ts");
  }
  const braceOpen = source.indexOf("{", start);
  const braceClose = source.indexOf("\n}", braceOpen);
  const body = source.slice(braceOpen + 1, braceClose);

  const names = new Set<string>();
  for (const line of body.split("\n")) {
    const match = /^\s*([A-Za-z][A-Za-z0-9]*)\s*\(/.exec(line);
    if (match) {
      names.add(match[1]!);
    }
  }
  return names;
}
