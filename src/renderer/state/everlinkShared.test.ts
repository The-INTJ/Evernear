// Covers the re-anchoring commit helpers shared by useEverlink
// and useEverslice. The invariant under test: the anchor's
// versionSeen must match the persisted targetDoc.currentVersion
// (not any fresher in-flight state) and flushPersistence must be
// awaited before the editor snapshot is read. Getting either of
// these wrong silently corrupts slice anchoring — the race window
// this module was extracted to close.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  HARNESS_CONTENT_FORMAT,
  HARNESS_CONTENT_SCHEMA_VERSION,
  type StoredDocumentSnapshot,
} from "../../shared/domain/document";
import type { WorkspaceState } from "../../shared/domain/workspace";
import type {
  HarnessEditorHandle,
  HarnessEditorSnapshot,
} from "../editor/HarnessEditor";
import {
  commitSliceWithFreshAnchor,
  resolveAnchorSnapshot,
} from "./everlinkShared";

function makeEditorSnapshot(overrides: Partial<HarnessEditorSnapshot> = {}): HarnessEditorSnapshot {
  return {
    contentJson: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hello editor world" }],
        },
      ],
    },
    plainText: "Hello editor world",
    metrics: { wordCount: 3, characterCount: 18, paragraphCount: 1 },
    ...overrides,
  };
}

function makeTargetDoc(overrides: Partial<StoredDocumentSnapshot> = {}): StoredDocumentSnapshot {
  return {
    id: "doc-target",
    title: "Target Doc",
    contentFormat: HARNESS_CONTENT_FORMAT,
    contentSchemaVersion: HARNESS_CONTENT_SCHEMA_VERSION,
    contentJson: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "stale DB contentJson" }],
        },
      ],
    },
    plainText: "stale DB plainText",
    currentVersion: 42,
    updatedAt: "2026-04-19T00:00:00.000Z",
    ...overrides,
  };
}

function makeEditor(
  snapshot: HarnessEditorSnapshot,
  onGetSnapshot?: () => void,
): HarnessEditorHandle {
  return {
    getSnapshot: () => {
      onGetSnapshot?.();
      return snapshot;
    },
    getSelection: () => ({ from: 0, to: 0, empty: true, text: "" }),
    focus: () => {},
    selectAll: () => {},
    toggleBold: () => {},
    toggleItalic: () => {},
    replaceSelection: () => null,
  };
}

describe("resolveAnchorSnapshot", () => {
  it("merges editor contentJson/plainText with persisted doc identity and version", () => {
    const editorSnapshot = makeEditorSnapshot({
      plainText: "Hello editor world FRESH",
    });
    const editor = makeEditor(editorSnapshot);
    const targetDoc = makeTargetDoc({
      plainText: "stale DB plainText",
      currentVersion: 42,
    });

    const merged = resolveAnchorSnapshot(editor, targetDoc);

    // Content fields come from the editor (what positions index into).
    expect(merged.contentJson).toBe(editorSnapshot.contentJson);
    expect(merged.plainText).toBe("Hello editor world FRESH");
    // Identity and persisted version come from the DB-side doc (what
    // the resolver needs to later map the anchor through subsequent
    // steps).
    expect(merged.id).toBe("doc-target");
    expect(merged.title).toBe("Target Doc");
    expect(merged.currentVersion).toBe(42);
    expect(merged.contentFormat).toBe(HARNESS_CONTENT_FORMAT);
    expect(merged.contentSchemaVersion).toBe(HARNESS_CONTENT_SCHEMA_VERSION);
  });
});

describe("commitSliceWithFreshAnchor", () => {
  let createSliceSpy: ReturnType<typeof vi.fn>;
  const nextWorkspace = {} as WorkspaceState;

  beforeEach(() => {
    createSliceSpy = vi.fn().mockResolvedValue(nextWorkspace);
    vi.stubGlobal("window", { evernear: { createSlice: createSliceSpy } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  type HelperOptions = Parameters<typeof commitSliceWithFreshAnchor>[0];

  function makeOptions(overrides: Partial<HelperOptions> = {}): HelperOptions {
    const targetDoc = makeTargetDoc();
    const workspaceRef = {
      current: { activeDocument: targetDoc, panelDocument: null } as unknown as WorkspaceState,
    };
    const editorSnapshot = makeEditorSnapshot();
    const editor = makeEditor(editorSnapshot);

    return {
      editor,
      projectId: "proj-1",
      entityId: "ent-1",
      targetDocumentId: "doc-target",
      // PM positions 7..19 in "Hello editor world" select "editor world".
      sourceText: "editor world",
      start: 7,
      end: 19,
      workspaceRef,
      flushPersistence: vi.fn().mockResolvedValue(undefined),
      applyWorkspace: vi.fn(),
      appendLog: vi.fn(),
      setBusy: vi.fn(),
      commitInFlightRef: { current: false },
      ...overrides,
    };
  }

  it("calls createSlice with the right payload and the editor's versionSeen", async () => {
    const opts = makeOptions();
    const result = await commitSliceWithFreshAnchor(opts);
    expect(result).toBe(true);
    expect(createSliceSpy).toHaveBeenCalledTimes(1);

    const payload = createSliceSpy.mock.calls[0][0];
    expect(payload.projectId).toBe("proj-1");
    expect(payload.entityId).toBe("ent-1");
    expect(payload.documentId).toBe("doc-target");
    expect(payload.title).toBe("editor world");
    expect(payload.anchor.documentId).toBe("doc-target");
    expect(payload.anchor.exact).toBe("editor world");
    // The anchor's versionSeen matches the DB-side currentVersion, not
    // any fresher state that might be in flight.
    expect(payload.anchor.versionSeen).toBe(42);
  });

  it("awaits flushPersistence before reading the editor snapshot", async () => {
    const order: string[] = [];
    const opts = makeOptions({
      flushPersistence: vi.fn(async () => {
        order.push("flush");
      }),
      editor: makeEditor(makeEditorSnapshot(), () => order.push("getSnapshot")),
    });

    await commitSliceWithFreshAnchor(opts);
    expect(order).toEqual(["flush", "getSnapshot"]);
  });

  it("applies the IPC result via applyWorkspace on success", async () => {
    const opts = makeOptions();
    await commitSliceWithFreshAnchor(opts);
    expect(opts.applyWorkspace).toHaveBeenCalledWith(
      nextWorkspace,
      expect.stringContaining("Committed the slice"),
    );
  });

  it("routes errors through appendLog and returns false without applying", async () => {
    createSliceSpy.mockRejectedValueOnce(new Error("DB ate it"));
    const opts = makeOptions();
    const result = await commitSliceWithFreshAnchor(opts);
    expect(result).toBe(false);
    expect(opts.appendLog).toHaveBeenCalledWith(
      expect.stringContaining("DB ate it"),
      "warn",
    );
    expect(opts.applyWorkspace).not.toHaveBeenCalled();
  });

  it("clears busy and in-flight flags even when the commit throws", async () => {
    createSliceSpy.mockRejectedValueOnce(new Error("boom"));
    const opts = makeOptions();
    await commitSliceWithFreshAnchor(opts);
    expect(opts.setBusy).toHaveBeenCalledWith(true);
    expect(opts.setBusy).toHaveBeenLastCalledWith(false);
    expect(opts.commitInFlightRef.current).toBe(false);
  });

  it("returns false without work when commitInFlightRef is already set", async () => {
    const opts = makeOptions();
    opts.commitInFlightRef.current = true;
    const result = await commitSliceWithFreshAnchor(opts);
    expect(result).toBe(false);
    expect(opts.setBusy).not.toHaveBeenCalled();
    expect(opts.flushPersistence).not.toHaveBeenCalled();
    expect(createSliceSpy).not.toHaveBeenCalled();
    // The guard must not clear the flag it did not set.
    expect(opts.commitInFlightRef.current).toBe(true);
  });

  it("fails closed when the target document cannot be found in the workspace", async () => {
    const opts = makeOptions();
    opts.workspaceRef.current = null;
    const result = await commitSliceWithFreshAnchor(opts);
    expect(result).toBe(false);
    expect(opts.appendLog).toHaveBeenCalledWith(
      expect.stringContaining("Could not find the target document"),
      "warn",
    );
    expect(createSliceSpy).not.toHaveBeenCalled();
    expect(opts.commitInFlightRef.current).toBe(false);
  });

  it("finds the target doc on the panel surface too", async () => {
    const panelDoc = makeTargetDoc({ id: "doc-panel", currentVersion: 7 });
    const opts = makeOptions({
      targetDocumentId: "doc-panel",
      workspaceRef: {
        current: { activeDocument: null, panelDocument: panelDoc } as unknown as WorkspaceState,
      },
    });

    const result = await commitSliceWithFreshAnchor(opts);
    expect(result).toBe(true);
    const payload = createSliceSpy.mock.calls[0][0];
    expect(payload.documentId).toBe("doc-panel");
    expect(payload.anchor.versionSeen).toBe(7);
  });
});
