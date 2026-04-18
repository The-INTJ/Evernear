import { useEffect, useRef, useState } from "react";

import type { HarnessStatus } from "../shared/contracts/harnessApi";
import {
  type DocumentMetrics,
  type JsonObject,
  type StoredDocumentSnapshot,
  collectDocumentMetrics,
} from "../shared/domain/document";
import {
  HarnessEditor,
  type HarnessEditorHandle,
  type HarnessEditorSnapshot,
} from "./editor/HarnessEditor";

type RunLogTone = "info" | "success" | "warn";

type RunLogEntry = {
  id: number;
  message: string;
  tone: RunLogTone;
  createdAt: string;
};

type VerificationState = {
  copiedText: string;
  expectedText: string;
  matches: boolean | null;
  usedBrowserCopyPath: boolean;
  richHtmlPresent: boolean | null;
};

const emptyDocumentJson: JsonObject = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

export function App() {
  const editorRef = useRef<HarnessEditorHandle | null>(null);

  const [status, setStatus] = useState<HarnessStatus | null>(null);
  const [persistedSnapshot, setPersistedSnapshot] = useState<StoredDocumentSnapshot | null>(null);
  const [editorSeed, setEditorSeed] = useState<JsonObject>(emptyDocumentJson);
  const [documentRevision, setDocumentRevision] = useState(0);
  const [draftSnapshot, setDraftSnapshot] = useState<HarnessEditorSnapshot | null>(null);
  const [decorationsEnabled, setDecorationsEnabled] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSaveMs, setLastSaveMs] = useState<number | null>(null);
  const [lastReloadMs, setLastReloadMs] = useState<number | null>(null);
  const [verificationState, setVerificationState] = useState<VerificationState>({
    copiedText: "",
    expectedText: "",
    matches: null,
    usedBrowserCopyPath: false,
    richHtmlPresent: null,
  });
  const [runLog, setRunLog] = useState<RunLogEntry[]>([]);

  useEffect(() => {
    void initializeHarness();
  }, []);

  async function initializeHarness(): Promise<void> {
    setIsBusy(true);

    try {
      const [nextStatus, nextSnapshot] = await Promise.all([
        window.evernear.getStatus(),
        window.evernear.loadDocument(),
      ]);

      setStatus(nextStatus);

      if (nextSnapshot) {
        applyLoadedSnapshot(nextSnapshot, "Harness document opened.");
      }
    } catch (error) {
      appendLog(`Failed to initialize the harness: ${stringifyError(error)}`, "warn");
    } finally {
      setIsBusy(false);
    }
  }

  function applyLoadedSnapshot(snapshot: StoredDocumentSnapshot, message: string): void {
    setPersistedSnapshot(snapshot);
    setEditorSeed(snapshot.contentJson);
    setDocumentRevision((current) => current + 1);
    setDraftSnapshot({
      contentJson: snapshot.contentJson,
      plainText: snapshot.plainText,
      metrics: collectDocumentMetrics(snapshot.plainText),
    });
    setIsDirty(false);
    appendLog(message, "success");
  }

  function appendLog(message: string, tone: RunLogTone): void {
    setRunLog((current) => [
      {
        id: current.length + 1,
        message,
        tone,
        createdAt: new Date().toLocaleTimeString(),
      },
      ...current,
    ]);
  }

  function handleDocumentChange(nextSnapshot: HarnessEditorSnapshot): void {
    setDraftSnapshot(nextSnapshot);
    setIsDirty(
      persistedSnapshot ? nextSnapshot.plainText !== persistedSnapshot.plainText : nextSnapshot.plainText.length > 0,
    );
  }

  function focusEditorSoon(): void {
    window.setTimeout(() => {
      editorRef.current?.focus();
    }, 0);
  }

  async function handleSave(): Promise<void> {
    const editor = editorRef.current;
    const snapshot = editor?.getSnapshot();

    if (!editor || !snapshot || !status || !persistedSnapshot) {
      return;
    }

    setIsBusy(true);
    const startedAt = performance.now();

    try {
      const savedSnapshot = await window.evernear.saveDocument({
        id: persistedSnapshot.id,
        title: persistedSnapshot.title,
        contentJson: snapshot.contentJson,
        plainText: snapshot.plainText,
      });

      setPersistedSnapshot(savedSnapshot);
      setDraftSnapshot({
        contentJson: savedSnapshot.contentJson,
        plainText: savedSnapshot.plainText,
        metrics: snapshot.metrics,
      });
      setIsDirty(false);
      setLastSaveMs(performance.now() - startedAt);
      appendLog(
        `Saved ${formatCount(snapshot.metrics.wordCount)} words to ${status.dbPath}.`,
        "success",
      );
      editor.focus();
    } catch (error) {
      appendLog(`Save failed: ${stringifyError(error)}`, "warn");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleReload(): Promise<void> {
    setIsBusy(true);
    const startedAt = performance.now();

    try {
      const snapshot = await window.evernear.loadDocument();
      if (!snapshot) {
        appendLog("Reload returned no document.", "warn");
        return;
      }

      setLastReloadMs(performance.now() - startedAt);
      applyLoadedSnapshot(snapshot, "Reloaded the persisted snapshot.");
      focusEditorSoon();
    } catch (error) {
      appendLog(`Reload failed: ${stringifyError(error)}`, "warn");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSeedFixture(): Promise<void> {
    setIsBusy(true);

    try {
      const result = await window.evernear.seedFixture();
      applyLoadedSnapshot(
        result.snapshot,
        `Seeded the 50k+ manuscript fixture at ${formatCount(result.wordCount)} words.`,
      );
      focusEditorSoon();
      setVerificationState({
        copiedText: "",
        expectedText: "",
        matches: null,
        usedBrowserCopyPath: false,
        richHtmlPresent: null,
      });
    } catch (error) {
      appendLog(`Fixture seeding failed: ${stringifyError(error)}`, "warn");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleVerifyCleanCopy(): Promise<void> {
    const editor = editorRef.current;

    if (!editor) {
      return;
    }

    setIsBusy(true);

    try {
      await window.evernear.clearClipboard();
      editor.focus();
      editor.selectAll();

      const usedBrowserCopyPath = document.execCommand("copy");
      await delay(60);

      const copiedText = await window.evernear.readClipboardText();
      const copiedHtml = await window.evernear.readClipboardHtml();
      const expectedText = editor.getSnapshot().plainText;
      const matches = copiedText === expectedText;

      setVerificationState({
        copiedText,
        expectedText,
        matches,
        usedBrowserCopyPath,
        richHtmlPresent: copiedHtml.trim().length > 0,
      });

      appendLog(
        matches
          ? "Clean-copy verification matched the plain-text projection."
          : "Clipboard verification drifted from the plain-text projection.",
        matches ? "success" : "warn",
      );
    } catch (error) {
      appendLog(`Clipboard verification failed: ${stringifyError(error)}`, "warn");
    } finally {
      setIsBusy(false);
    }
  }

  const activeMetrics: DocumentMetrics = draftSnapshot?.metrics
    ?? collectDocumentMetrics(persistedSnapshot?.plainText ?? "");

  return (
    <div className="app-shell">
      <header className="hero-panel">
        <div>
          <p className="eyebrow">Phase 1 Proof Harness</p>
          <h1>Single-document round trip, clean clipboard, no fake shortcuts.</h1>
          <p className="hero-copy">
            This build proves the SQLite snapshot seam, long-manuscript reloads, and clean copy
            behavior while renderer-only decorations are visible.
          </p>
        </div>
        <div className="hero-meta">
          <span className={isDirty ? "meta-pill meta-pill--dirty" : "meta-pill"}>
            {isDirty ? "Unsaved edits" : "Projection in sync"}
          </span>
          <span className="meta-pill">{decorationsEnabled ? "Decorations on" : "Decorations off"}</span>
          <span className="meta-pill">{isBusy ? "Working" : "Ready"}</span>
        </div>
      </header>

      <section className="toolbar-panel">
        <div className="toolbar-actions">
          <button className="primary-button" onClick={handleSeedFixture} disabled={isBusy}>
            Seed 50k+ Fixture
          </button>
          <button className="secondary-button" onClick={handleSave} disabled={isBusy || !persistedSnapshot}>
            Save Snapshot
          </button>
          <button className="secondary-button" onClick={handleReload} disabled={isBusy}>
            Reload Snapshot
          </button>
          <button className="secondary-button" onClick={handleVerifyCleanCopy} disabled={isBusy}>
            Verify Clean Copy
          </button>
          <button
            className="secondary-button"
            onClick={() => {
              editorRef.current?.toggleBold();
              focusEditorSoon();
            }}
            disabled={isBusy}
          >
            Bold
          </button>
          <button
            className="secondary-button"
            onClick={() => {
              editorRef.current?.toggleItalic();
              focusEditorSoon();
            }}
            disabled={isBusy}
          >
            Italic
          </button>
          <button
            className="secondary-button"
            onClick={() => {
              setDecorationsEnabled((current) => !current);
              focusEditorSoon();
            }}
            disabled={isBusy}
          >
            {decorationsEnabled ? "Hide Decorations" : "Show Decorations"}
          </button>
        </div>
        <div className="toolbar-notes">
          <span>Document ID: {status?.documentId ?? "loading..."}</span>
          <span>SQLite file: {status?.dbPath ?? "loading..."}</span>
        </div>
      </section>

      <section className="stats-grid">
        <MetricCard label="Words" value={formatCount(activeMetrics.wordCount)} />
        <MetricCard label="Paragraphs" value={formatCount(activeMetrics.paragraphCount)} />
        <MetricCard label="Characters" value={formatCount(activeMetrics.characterCount)} />
        <MetricCard
          label="Last Save"
          value={lastSaveMs === null ? "Not run" : `${Math.round(lastSaveMs)} ms`}
        />
        <MetricCard
          label="Last Reload"
          value={lastReloadMs === null ? "Not run" : `${Math.round(lastReloadMs)} ms`}
        />
        <MetricCard
          label="Copy Proof"
          value={
            verificationState.matches === null
              ? "Pending"
              : verificationState.matches
                ? "Matched"
                : "Drift detected"
          }
        />
      </section>

      <main className="workspace-grid">
        <section className="workspace-card workspace-card--editor">
          <div className="card-header">
            <div>
              <p className="section-kicker">Editor Surface</p>
              <h2>{persistedSnapshot?.title ?? "Round-trip manuscript"}</h2>
            </div>
            <p className="section-copy">
              `Ctrl+A` and `Ctrl+C` should stay clean even when highlights and boundary rails are visible.
              This harness simulates derived highlights only; hover preview is intentionally not part of this proof build.
            </p>
          </div>

          <HarnessEditor
            key={documentRevision}
            ref={editorRef}
            initialDocumentJson={editorSeed}
            decorationsEnabled={decorationsEnabled}
            onDocumentChange={handleDocumentChange}
          />
        </section>

        <aside className="workspace-card workspace-card--sidebar">
          <section className="sidebar-section">
            <p className="section-kicker">Clipboard Proof</p>
            <h2>Verification Surface</h2>
            <p className="section-copy">
              The check button runs a select-all plus browser copy path, then compares the clipboard text
              to the stored plain-text projection. Rich HTML clipboard data may still be present even though
              the proof comparison here is intentionally text-first.
            </p>
            <div className="verification-summary">
              <span
                className={
                  verificationState.matches === null
                    ? "verification-pill"
                    : verificationState.matches
                      ? "verification-pill verification-pill--success"
                      : "verification-pill verification-pill--warn"
                }
              >
                {verificationState.matches === null
                  ? "Not run"
                  : verificationState.matches
                    ? "Exact match"
                    : "Mismatch"}
              </span>
              <span className="verification-note">
                Browser copy path: {verificationState.usedBrowserCopyPath ? "used" : "not yet observed"}
              </span>
              <span className="verification-note">
                Rich HTML clipboard: {formatRichClipboardState(verificationState.richHtmlPresent)}
              </span>
            </div>
            <textarea
              className="verification-textarea"
              readOnly
              value={verificationState.copiedText}
              placeholder="Clipboard text will appear here after verification."
            />
          </section>

          <section className="sidebar-section">
            <p className="section-kicker">Expected Projection</p>
            <h2>Plain Text</h2>
            <textarea
              className="projection-textarea"
              readOnly
              value={verificationState.expectedText || draftSnapshot?.plainText || ""}
              placeholder="The current plain-text projection will appear here."
            />
          </section>

          <section className="sidebar-section">
            <p className="section-kicker">Run Log</p>
            <h2>Execution Notes</h2>
            <div className="run-log">
              {runLog.length === 0 ? (
                <p className="empty-state">Harness events will show up here as you seed, save, reload, and verify.</p>
              ) : (
                runLog.map((entry) => (
                  <article key={entry.id} className={`run-log-entry run-log-entry--${entry.tone}`}>
                    <div className="run-log-meta">
                      <span>{entry.createdAt}</span>
                      <span>{entry.tone}</span>
                    </div>
                    <p>{entry.message}</p>
                  </article>
                ))
              )}
            </div>
          </section>
        </aside>
      </main>
    </div>
  );
}

function MetricCard(props: { label: string; value: string }) {
  return (
    <article className="metric-card">
      <span className="metric-label">{props.label}</span>
      <strong className="metric-value">{props.value}</strong>
    </article>
  );
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function stringifyError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function formatRichClipboardState(value: boolean | null): string {
  if (value === null) {
    return "not checked";
  }

  return value ? "present" : "missing";
}
