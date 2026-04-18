import { useEffect, useRef, useState } from "react";

import {
  layout,
  measureLineStats,
  prepareWithSegments,
  walkLineRanges,
} from "@chenglou/pretext";

import {
  HARNESS_DOCUMENT_ID,
  HARNESS_DOCUMENT_TITLE,
  type JsonObject,
  type StoredDocumentSnapshot,
  collectDocumentMetrics,
} from "../shared/domain/document";
import type {
  AnchorProbeKind,
  AnchorScenarioRun,
  ClipboardAuditResult,
  HistoryReplayResult,
  HistoryScenarioResult,
  LayoutDecision,
  LayoutProbeResult,
  MatchingBenchmark,
  MatchingRuleKind,
  MatchingRuleRecord,
  MatchingScenarioResult,
  WorkbenchState,
  WorkbenchStatus,
} from "../shared/domain/workbench";
import { createEmptyHarnessSnapshot } from "../shared/domain/harnessFixture";
import {
  HarnessEditor,
  type HarnessEditorHandle,
  type HarnessEditorSnapshot,
} from "./editor/HarnessEditor";
import {
  buildClipboardAudit,
  buildTextAnchorFromSelection,
  type EditorSelectionInfo,
  type SerializedTransactionBundle,
} from "./editor/workbenchUtils";

type TabId = "document" | "anchors" | "matching" | "history" | "layout";
type RunLogTone = "info" | "success" | "warn";

type RunLogEntry = {
  id: number;
  message: string;
  tone: RunLogTone;
  createdAt: string;
};

type MatchingFormState = {
  label: string;
  kind: MatchingRuleKind;
  pattern: string;
  wholeWord: boolean;
  allowPossessive: boolean;
  enabled: boolean;
};

const emptyDocumentJson: JsonObject = createEmptyHarnessSnapshot().contentJson;
const initialImportSnapshot = snapshotToEditorSnapshot(createEmptyHarnessSnapshot());
const initialMatchingForm: MatchingFormState = {
  label: "",
  kind: "literal",
  pattern: "",
  wholeWord: true,
  allowPossessive: true,
  enabled: true,
};

export function App() {
  const mainEditorRef = useRef<HarnessEditorHandle | null>(null);
  const importEditorRef = useRef<HarnessEditorHandle | null>(null);
  const mainEditorHostRef = useRef<HTMLDivElement | null>(null);
  const transactionQueueRef = useRef<Promise<void>>(Promise.resolve());
  const persistenceEpochRef = useRef(0);
  const persistedVersionRef = useRef(0);
  const workbenchStateRef = useRef<WorkbenchState | null>(null);

  const [status, setStatus] = useState<WorkbenchStatus | null>(null);
  const [workbenchState, setWorkbenchState] = useState<WorkbenchState | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("document");
  const [documentRevision, setDocumentRevision] = useState(0);
  const [documentSeed, setDocumentSeed] = useState<JsonObject>(emptyDocumentJson);
  const [liveSnapshot, setLiveSnapshot] = useState<HarnessEditorSnapshot | null>(null);
  const [importRevision, setImportRevision] = useState(0);
  const [importSeed, setImportSeed] = useState<JsonObject>(emptyDocumentJson);
  const [importSnapshot, setImportSnapshot] = useState<HarnessEditorSnapshot>(initialImportSnapshot);
  const [mainSelection, setMainSelection] = useState<EditorSelectionInfo>({
    from: 0,
    to: 0,
    empty: true,
    text: "",
  });
  const [matchingForm, setMatchingForm] = useState<MatchingFormState>(initialMatchingForm);
  const [anchorLabel, setAnchorLabel] = useState("");
  const [decorationsEnabled, setDecorationsEnabled] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [pendingWrites, setPendingWrites] = useState(0);
  const [clipboardAudit, setClipboardAudit] = useState<ClipboardAuditResult | null>(null);
  const [replayVersion, setReplayVersion] = useState("");
  const [replayResult, setReplayResult] = useState<HistoryReplayResult | null>(null);
  const [anchorScenario, setAnchorScenario] = useState<AnchorScenarioRun | null>(null);
  const [matchingScenario, setMatchingScenario] = useState<MatchingScenarioResult | null>(null);
  const [historyScenario, setHistoryScenario] = useState<HistoryScenarioResult | null>(null);
  const [layoutProbe, setLayoutProbe] = useState<LayoutProbeResult | null>(null);
  const [lastMatchingBenchmark, setLastMatchingBenchmark] = useState<MatchingBenchmark | null>(null);
  const [runLog, setRunLog] = useState<RunLogEntry[]>([]);

  useEffect(() => {
    void initializeWorkbench();
  }, []);

  async function initializeWorkbench(): Promise<void> {
    setIsBusy(true);

    try {
      const [nextStatus, nextState] = await Promise.all([
        window.evernear.getStatus(),
        window.evernear.loadState(),
      ]);

      setStatus(nextStatus);
      applyHydratedState(nextState, "Workbench opened against the persisted head.");
    } catch (error) {
      appendLog(`Failed to initialize the workbench: ${stringifyError(error)}`, "warn");
    } finally {
      setIsBusy(false);
    }
  }

  function replaceWorkbenchState(nextState: WorkbenchState): void {
    workbenchStateRef.current = nextState;
    setWorkbenchState(nextState);
    persistedVersionRef.current = nextState.snapshot?.currentVersion ?? 0;
  }

  function applyHydratedState(nextState: WorkbenchState, message: string): void {
    replaceWorkbenchState(nextState);
    setReplayResult(null);
    setClipboardAudit(null);
    const snapshot = nextState.snapshot;
    setDocumentSeed(snapshot?.contentJson ?? emptyDocumentJson);
    setDocumentRevision((current) => current + 1);
    setLiveSnapshot(snapshot ? snapshotToEditorSnapshot(snapshot) : null);
    appendLog(message, "success");
  }

  function patchWorkbenchState(project: (current: WorkbenchState) => WorkbenchState): void {
    const current = workbenchStateRef.current;
    if (!current) {
      return;
    }

    replaceWorkbenchState(project(current));
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

  async function flushTransactionQueue(): Promise<void> {
    await transactionQueueRef.current.catch(() => undefined);
  }

  function queueDocumentPersistence(
    snapshot: HarnessEditorSnapshot,
    transaction: SerializedTransactionBundle,
  ): void {
    const epoch = persistenceEpochRef.current;
    setPendingWrites((current) => current + 1);

    transactionQueueRef.current = transactionQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        if (epoch !== persistenceEpochRef.current) {
          return;
        }

        const currentState = workbenchStateRef.current;
        const currentDocument = currentState?.snapshot;
        if (!currentDocument) {
          return;
        }

        const result = await window.evernear.applyDocumentTransaction({
          documentId: currentDocument.id,
          baseVersion: persistedVersionRef.current,
          title: currentDocument.title,
          steps: transaction.steps,
          inverseSteps: transaction.inverseSteps,
          contentJson: snapshot.contentJson,
          plainText: snapshot.plainText,
        });

        if (epoch !== persistenceEpochRef.current) {
          return;
        }

        patchWorkbenchState((current) => ({
          ...current,
          snapshot: result.snapshot,
          historySummary: result.historySummary,
          anchorProbes: result.anchorProbes,
        }));
      })
      .catch((error) => {
        appendLog(`Document persistence drifted: ${stringifyError(error)}`, "warn");
      })
      .finally(() => {
        setPendingWrites((current) => Math.max(0, current - 1));
      });
  }

  function handleMainEditorSnapshotChange(
    snapshot: HarnessEditorSnapshot,
    transaction: SerializedTransactionBundle | null,
  ): void {
    setLiveSnapshot(snapshot);

    if (transaction) {
      queueDocumentPersistence(snapshot, transaction);
    }
  }

  function handleImportEditorSnapshotChange(
    snapshot: HarnessEditorSnapshot,
    _transaction: SerializedTransactionBundle | null,
  ): void {
    setImportSnapshot(snapshot);
  }

  function focusMainEditorSoon(): void {
    window.setTimeout(() => {
      mainEditorRef.current?.focus();
    }, 0);
  }

  async function reloadPersistedHead(message: string): Promise<void> {
    setIsBusy(true);

    try {
      await flushTransactionQueue();
      persistenceEpochRef.current += 1;
      const nextState = await window.evernear.loadState();
      applyHydratedState(nextState, message);
      focusMainEditorSoon();
    } catch (error) {
      appendLog(`Reload failed: ${stringifyError(error)}`, "warn");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleLoadSmallFixture(): Promise<void> {
    setIsBusy(true);

    try {
      await flushTransactionQueue();
      persistenceEpochRef.current += 1;
      const nextState = await window.evernear.loadSmallFixture();
      applyHydratedState(nextState, "Loaded the small deterministic fixture for edge-case probing.");
      setImportSeed(nextState.snapshot?.contentJson ?? emptyDocumentJson);
      setImportRevision((current) => current + 1);
      focusMainEditorSoon();
    } catch (error) {
      appendLog(`Fixture load failed: ${stringifyError(error)}`, "warn");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleWriteCheckpoint(): Promise<void> {
    setIsBusy(true);

    try {
      await flushTransactionQueue();
      await window.evernear.writeCheckpoint("manual-head-save");
      const nextState = await window.evernear.loadState();
      replaceWorkbenchState(nextState);
      appendLog(
        `Checkpoint saved at version ${nextState.historySummary.currentVersion}.`,
        "success",
      );
      focusMainEditorSoon();
    } catch (error) {
      appendLog(`Checkpoint save failed: ${stringifyError(error)}`, "warn");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleReplaceHeadFromImport(): Promise<void> {
    setIsBusy(true);

    try {
      await flushTransactionQueue();
      const snapshot = importEditorRef.current?.getSnapshot() ?? importSnapshot;
      persistenceEpochRef.current += 1;
      const nextState = await window.evernear.replaceDocumentHead({
        documentId: HARNESS_DOCUMENT_ID,
        title: HARNESS_DOCUMENT_TITLE,
        contentJson: snapshot.contentJson,
        plainText: snapshot.plainText,
        source: "import-slot",
      });

      applyHydratedState(nextState, `Imported ${formatCount(snapshot.metrics.wordCount)} words from the manuscript slot.`);
      focusMainEditorSoon();
    } catch (error) {
      appendLog(`Import replacement failed: ${stringifyError(error)}`, "warn");
    } finally {
      setIsBusy(false);
    }
  }

  function handleClearImportSlot(): void {
    setImportSeed(emptyDocumentJson);
    setImportRevision((current) => current + 1);
    setImportSnapshot(initialImportSnapshot);
    appendLog("Cleared the manuscript import slot.", "info");
  }

  function handleMirrorHeadIntoImportSlot(): void {
    const currentHead = workbenchStateRef.current?.snapshot;
    if (!currentHead) {
      return;
    }

    setImportSeed(currentHead.contentJson);
    setImportRevision((current) => current + 1);
    setImportSnapshot(snapshotToEditorSnapshot(currentHead));
    appendLog("Copied the persisted head into the import slot for comparison.", "info");
  }

  async function handleVerifyClipboard(): Promise<void> {
    const editor = mainEditorRef.current;
    if (!editor) {
      return;
    }

    setIsBusy(true);

    try {
      await flushTransactionQueue();
      await window.evernear.clearClipboard();
      editor.selectAll();
      editor.focus();
      document.execCommand("copy");
      await delay(60);

      const [copiedText, copiedHtml, reloadedState] = await Promise.all([
        window.evernear.readClipboardText(),
        window.evernear.readClipboardHtml(),
        window.evernear.loadState(),
      ]);

      replaceWorkbenchState(reloadedState);
      const persistedPlainText = reloadedState.snapshot?.plainText ?? "";
      const audit = buildClipboardAudit(copiedText, copiedHtml, persistedPlainText);
      setClipboardAudit(audit);

      const benchmark = await window.evernear.recordBenchmark("clipboard", audit as unknown as JsonObject);
      patchWorkbenchState((current) => ({
        ...current,
        benchmarks: [benchmark, ...current.benchmarks].slice(0, 20),
      }));

      appendLog(
        audit.copiedTextMatchesPersistedPlainText && !audit.leakedWorkbenchMarkup
          ? "Clipboard audit passed persisted plain-text parity and HTML leak checks."
          : "Clipboard audit found drift or leaked workbench markup.",
        audit.copiedTextMatchesPersistedPlainText && !audit.leakedWorkbenchMarkup ? "success" : "warn",
      );
      focusMainEditorSoon();
    } catch (error) {
      appendLog(`Clipboard audit failed: ${stringifyError(error)}`, "warn");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleCreateAnchorProbe(kind: AnchorProbeKind): Promise<void> {
    const selection = mainEditorRef.current?.getSelection() ?? mainSelection;
    if (!workbenchStateRef.current?.snapshot) {
      return;
    }

    setIsBusy(true);

    try {
      await flushTransactionQueue();
      const refreshedState = await window.evernear.loadState();
      replaceWorkbenchState(refreshedState);

      const refreshedSnapshot = refreshedState.snapshot;
      if (!refreshedSnapshot) {
        throw new Error("No persisted document head was available for anchoring.");
      }

      const anchor = buildTextAnchorFromSelection(refreshedSnapshot, selection);
      if (!anchor) {
        appendLog("Select a non-empty range before creating an anchor probe.", "warn");
        return;
      }

      const probe = await window.evernear.createAnchorProbe({
        kind,
        label: anchorLabel.trim() || defaultAnchorLabel(kind, refreshedState.anchorProbes.length + 1),
        anchor,
      });

      patchWorkbenchState((current) => ({
        ...current,
        anchorProbes: [probe, ...current.anchorProbes],
      }));
      setAnchorLabel("");
      appendLog(
        `Created ${kind} probe on "${truncate(selection.text || anchor.exact, 42)}".`,
        "success",
      );
      focusMainEditorSoon();
    } catch (error) {
      appendLog(`Anchor creation failed: ${stringifyError(error)}`, "warn");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDeleteAnchorProbe(probeId: string): Promise<void> {
    setIsBusy(true);

    try {
      const probes = await window.evernear.deleteAnchorProbe({ probeId });
      patchWorkbenchState((current) => ({
        ...current,
        anchorProbes: probes,
      }));
      appendLog("Removed an anchor probe from the workbench.", "info");
      focusMainEditorSoon();
    } catch (error) {
      appendLog(`Anchor deletion failed: ${stringifyError(error)}`, "warn");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSubmitMatchingRule(): Promise<void> {
    if (matchingForm.label.trim().length === 0 || matchingForm.pattern.trim().length === 0) {
      appendLog("Matching rules need both a label and a pattern.", "warn");
      return;
    }

    setIsBusy(true);

    try {
      const rules = await window.evernear.upsertMatchingRule({
        label: matchingForm.label.trim(),
        kind: matchingForm.kind,
        pattern: matchingForm.pattern,
        wholeWord: matchingForm.wholeWord,
        allowPossessive: matchingForm.allowPossessive,
        enabled: matchingForm.enabled,
      });

      patchWorkbenchState((current) => ({
        ...current,
        matchingRules: rules,
      }));
      setMatchingForm(initialMatchingForm);
      appendLog(`Added matching rule "${truncate(matchingForm.label.trim(), 28)}".`, "success");
      focusMainEditorSoon();
    } catch (error) {
      appendLog(`Rule creation failed: ${stringifyError(error)}`, "warn");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleToggleMatchingRule(rule: MatchingRuleRecord): Promise<void> {
    try {
      const rules = await window.evernear.upsertMatchingRule({
        id: rule.id,
        label: rule.label,
        kind: rule.kind,
        pattern: rule.pattern,
        wholeWord: rule.wholeWord,
        allowPossessive: rule.allowPossessive,
        enabled: !rule.enabled,
      });

      patchWorkbenchState((current) => ({
        ...current,
        matchingRules: rules,
      }));
    } catch (error) {
      appendLog(`Rule toggle failed: ${stringifyError(error)}`, "warn");
    }
  }

  async function handleDeleteMatchingRule(ruleId: string): Promise<void> {
    try {
      const rules = await window.evernear.deleteMatchingRule({ ruleId });
      patchWorkbenchState((current) => ({
        ...current,
        matchingRules: rules,
      }));
      appendLog("Deleted a matching rule.", "info");
    } catch (error) {
      appendLog(`Rule deletion failed: ${stringifyError(error)}`, "warn");
    }
  }

  async function handleRunAnchorScenarios(): Promise<void> {
    setIsBusy(true);

    try {
      const result = await window.evernear.runAnchorScenarios();
      setAnchorScenario(result);
      appendLog("Ran the anchor repair / ambiguity / invalidation scenarios.", "success");
    } catch (error) {
      appendLog(`Anchor scenarios failed: ${stringifyError(error)}`, "warn");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleRunMatchingScenarios(): Promise<void> {
    setIsBusy(true);

    try {
      const result = await window.evernear.runMatchingScenarios();
      setMatchingScenario(result);
      appendLog("Ran the matching normalization and regex scenarios.", "success");
    } catch (error) {
      appendLog(`Matching scenarios failed: ${stringifyError(error)}`, "warn");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleRecordMatchingBenchmark(): Promise<void> {
    if (!lastMatchingBenchmark) {
      appendLog("Scroll or type with overlays on before recording a matching benchmark.", "warn");
      return;
    }

    try {
      const benchmark = await window.evernear.recordBenchmark("matching", lastMatchingBenchmark as unknown as JsonObject);
      patchWorkbenchState((current) => ({
        ...current,
        benchmarks: [benchmark, ...current.benchmarks].slice(0, 20),
      }));
      appendLog("Recorded the latest visible-range matching benchmark.", "success");
    } catch (error) {
      appendLog(`Benchmark recording failed: ${stringifyError(error)}`, "warn");
    }
  }

  async function handleReplayDocument(): Promise<void> {
    const targetVersion = Number.parseInt(replayVersion, 10);
    if (!Number.isFinite(targetVersion)) {
      appendLog("Enter a numeric version before replaying history.", "warn");
      return;
    }

    setIsBusy(true);

    try {
      await flushTransactionQueue();
      const result = await window.evernear.replayDocumentToVersion(targetVersion);
      setReplayResult(result);
      appendLog(`Replayed the document head to version ${targetVersion}.`, "success");
    } catch (error) {
      appendLog(`Replay failed: ${stringifyError(error)}`, "warn");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleRestoreReplay(): Promise<void> {
    if (!replayResult) {
      return;
    }

    setIsBusy(true);

    try {
      await flushTransactionQueue();
      persistenceEpochRef.current += 1;
      const nextState = await window.evernear.replaceDocumentHead({
        documentId: HARNESS_DOCUMENT_ID,
        title: replayResult.snapshot.title,
        contentJson: replayResult.snapshot.contentJson,
        plainText: replayResult.snapshot.plainText,
        source: "replay-restore",
      });
      applyHydratedState(nextState, `Restored replayed version ${replayResult.snapshot.currentVersion} as the live head.`);
      focusMainEditorSoon();
    } catch (error) {
      appendLog(`Replay restore failed: ${stringifyError(error)}`, "warn");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleRunHistoryScenario(): Promise<void> {
    setIsBusy(true);

    try {
      await flushTransactionQueue();
      const result = await window.evernear.runHistoryScenario();
      setHistoryScenario(result);
      appendLog("Ran the history replay and projection rebuild parity checks.", "success");
    } catch (error) {
      appendLog(`History scenario failed: ${stringifyError(error)}`, "warn");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleMeasureLayout(): Promise<void> {
    const host = mainEditorHostRef.current;
    const snapshot = liveSnapshot;
    if (!host || !snapshot) {
      return;
    }

    setIsBusy(true);

    try {
      await flushTransactionQueue();
      const domMetrics = measureDomLayout(host);
      if (!domMetrics) {
        throw new Error("The editor surface was not available for layout measurement.");
      }

      const pretextMetrics = measurePretextLayout(
        snapshot.plainText,
        domMetrics.font,
        domMetrics.textWidth,
        domMetrics.lineHeight,
        domMetrics.scrollTop,
        domMetrics.viewportHeight,
      );

      const result: LayoutProbeResult = {
        width: Math.round(domMetrics.textWidth),
        lineHeight: roundNumber(domMetrics.lineHeight),
        domHeight: Math.round(domMetrics.domHeight),
        domVisibleBlockCount: domMetrics.domVisibleBlockCount,
        domComputationMs: roundNumber(domMetrics.domComputationMs),
        pretextHeight: Math.round(pretextMetrics.pretextHeight),
        pretextLineCount: pretextMetrics.pretextLineCount,
        pretextVisibleLineCount: pretextMetrics.pretextVisibleLineCount,
        pretextComputationMs: roundNumber(pretextMetrics.pretextComputationMs),
        decision: decideLayoutPath(domMetrics.domHeight, pretextMetrics.pretextHeight),
        createdAt: new Date().toISOString(),
      };

      setLayoutProbe(result);
      const benchmark = await window.evernear.recordBenchmark("layout", result as unknown as JsonObject);
      patchWorkbenchState((current) => ({
        ...current,
        benchmarks: [benchmark, ...current.benchmarks].slice(0, 20),
      }));

      appendLog(
        `Measured DOM vs Pretext layout at ${Math.round(domMetrics.textWidth)} px.`,
        "success",
      );
    } catch (error) {
      appendLog(`Layout probe failed: ${stringifyError(error)}`, "warn");
    } finally {
      setIsBusy(false);
    }
  }

  const persistedSnapshot = workbenchState?.snapshot ?? null;
  const liveMetrics = liveSnapshot?.metrics ?? collectDocumentMetrics(persistedSnapshot?.plainText ?? "");
  const matchingRules = workbenchState?.matchingRules ?? [];
  const anchorProbes = workbenchState?.anchorProbes ?? [];
  const historySummary = workbenchState?.historySummary;
  const latestClipboardStatus = clipboardAudit
    ? clipboardAudit.copiedTextMatchesPersistedPlainText && !clipboardAudit.leakedWorkbenchMarkup
      ? "Clean"
      : "Review"
    : "Pending";

  return (
    <div className="app-shell workbench-shell">
      <header className="hero-panel workbench-hero">
        <div>
          <p className="eyebrow">Phase 1 Proof Workbench</p>
          <h1>Import real prose, probe anchors, measure matching, and pressure-test history before MVP.</h1>
          <p className="hero-copy">
            This shell is intentionally not the product. It is the local-only proof bench for the
            remaining Phase 1 questions: better-sqlite3 durability, real-manuscript intake,
            shared TextAnchor healing, visible-range matching, event-log replay, and Pretext viability.
          </p>
        </div>
        <div className="hero-meta">
          <span className={pendingWrites > 0 ? "meta-pill meta-pill--dirty" : "meta-pill"}>
            {pendingWrites > 0 ? `${pendingWrites} pending write${pendingWrites === 1 ? "" : "s"}` : "Head persisted"}
          </span>
          <span className="meta-pill">{decorationsEnabled ? "Derived overlays on" : "Derived overlays off"}</span>
          <span className="meta-pill">{isBusy ? "Workbench busy" : "Workbench ready"}</span>
          <span className="meta-pill">{status?.storageEngine ?? "storage pending"}</span>
        </div>
      </header>

      <section className="toolbar-panel workbench-toolbar">
        <div className="toolbar-actions">
          <button className="primary-button" onClick={handleLoadSmallFixture} disabled={isBusy} type="button">
            Load Small Fixture
          </button>
          <button className="secondary-button" onClick={handleWriteCheckpoint} disabled={isBusy || !persistedSnapshot} type="button">
            Save Head Checkpoint
          </button>
          <button className="secondary-button" onClick={() => void reloadPersistedHead("Reloaded the persisted head from SQLite.")} disabled={isBusy} type="button">
            Reload Persisted Head
          </button>
          <button className="secondary-button" onClick={handleVerifyClipboard} disabled={isBusy || !persistedSnapshot} type="button">
            Audit Clipboard
          </button>
          <button
            className="secondary-button"
            onClick={() => {
              mainEditorRef.current?.toggleBold();
              focusMainEditorSoon();
            }}
            disabled={isBusy}
            type="button"
          >
            Bold
          </button>
          <button
            className="secondary-button"
            onClick={() => {
              mainEditorRef.current?.toggleItalic();
              focusMainEditorSoon();
            }}
            disabled={isBusy}
            type="button"
          >
            Italic
          </button>
          <button
            className="secondary-button"
            onClick={() => {
              setDecorationsEnabled((current) => !current);
              focusMainEditorSoon();
            }}
            disabled={isBusy}
            type="button"
          >
            {decorationsEnabled ? "Hide Overlays" : "Show Overlays"}
          </button>
        </div>
        <div className="toolbar-notes">
          <span>Document: {status?.documentId ?? "loading..."}</span>
          <span>SQLite: {status?.dbPath ?? "loading..."}</span>
          <span>{status ? `WAL / synchronous ${status.synchronousMode}` : "storage pending"}</span>
        </div>
      </section>

      <section className="stats-grid workbench-stats">
        <MetricCard label="Words" value={formatCount(liveMetrics.wordCount)} />
        <MetricCard label="Version" value={String(historySummary?.currentVersion ?? 0)} />
        <MetricCard label="Steps" value={formatCount(historySummary?.stepCount ?? 0)} />
        <MetricCard label="Checkpoints" value={formatCount(historySummary?.checkpointCount ?? 0)} />
        <MetricCard label="Events" value={formatCount(historySummary?.eventCount ?? 0)} />
        <MetricCard label="Clipboard" value={latestClipboardStatus} />
      </section>

      <nav className="tab-strip" aria-label="Workbench views">
        {([
          ["document", "Document"],
          ["anchors", "Anchors"],
          ["matching", "Matching"],
          ["history", "History"],
          ["layout", "Layout"],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            className={activeTab === id ? "tab-button tab-button--active" : "tab-button"}
            onClick={() => setActiveTab(id)}
            type="button"
          >
            {label}
          </button>
        ))}
      </nav>

      <main className="workspace-grid workbench-grid">
        <section className="workspace-card workspace-card--editor">
          <div className="card-header">
            <div>
              <p className="section-kicker">Live Head</p>
              <h2>{persistedSnapshot?.title ?? HARNESS_DOCUMENT_TITLE}</h2>
            </div>
            <p className="section-copy">
              The main editor persists every transaction into the history substrate. Explicit
              "save" writes a checkpoint, while reload remounts the persisted head so we can
              sanity-check replay and import behavior without pretending this is the final UX.
            </p>
          </div>

          <div className="editor-host" ref={mainEditorHostRef}>
            <HarnessEditor
              key={documentRevision}
              ref={mainEditorRef}
              initialDocumentJson={documentSeed}
              decorationsEnabled={decorationsEnabled}
              matchingRules={matchingRules}
              anchorProbes={anchorProbes}
              onDocumentSnapshotChange={handleMainEditorSnapshotChange}
              onSelectionChange={setMainSelection}
              onMatchingBenchmark={setLastMatchingBenchmark}
            />
          </div>
        </section>

        <aside className="workspace-card workspace-card--sidebar">
          {activeTab === "document" ? (
            <>
              <section className="sidebar-section">
                <p className="section-kicker">Import Slot</p>
                <h2>Paste the real manuscript here</h2>
                <p className="section-copy">
                  This is the canonical Phase 1 ingest path. Paste directly from Google Docs into
                  the import slot, then replace the persisted head from it. The manuscript stays local and untracked.
                </p>
                <div className="toolbar-actions">
                  <button className="secondary-button" onClick={handleMirrorHeadIntoImportSlot} type="button">
                    Mirror Current Head
                  </button>
                  <button className="secondary-button" onClick={handleClearImportSlot} type="button">
                    Clear Slot
                  </button>
                  <button className="primary-button" onClick={() => void handleReplaceHeadFromImport()} disabled={isBusy} type="button">
                    Replace Head From Import
                  </button>
                </div>
                <div className="import-note-grid">
                  <MetricCard label="Import Words" value={formatCount(importSnapshot.metrics.wordCount)} compact />
                  <MetricCard label="Import Paragraphs" value={formatCount(importSnapshot.metrics.paragraphCount)} compact />
                  <MetricCard label="Import Characters" value={formatCount(importSnapshot.metrics.characterCount)} compact />
                </div>
                <HarnessEditor
                  key={importRevision}
                  ref={importEditorRef}
                  initialDocumentJson={importSeed}
                  decorationsEnabled={false}
                  showLegend={false}
                  onDocumentSnapshotChange={handleImportEditorSnapshotChange}
                  onSelectionChange={() => undefined}
                />
              </section>

              <section className="sidebar-section">
                <p className="section-kicker">Clipboard Audit</p>
                <h2>Persisted plain text + clean HTML</h2>
                <div className="verification-summary">
                  <span className={clipboardAudit ? auditPillClassName(clipboardAudit) : "verification-pill"}>
                    {clipboardAudit
                      ? clipboardAudit.copiedTextMatchesPersistedPlainText && !clipboardAudit.leakedWorkbenchMarkup
                        ? "Audit passed"
                        : "Audit flagged"
                      : "Not run"}
                  </span>
                  <span className="verification-note">
                    Plain text parity: {clipboardAudit ? booleanWord(clipboardAudit.copiedTextMatchesPersistedPlainText) : "pending"}
                  </span>
                  <span className="verification-note">
                    Rich HTML present: {clipboardAudit ? booleanWord(clipboardAudit.richHtmlPresent) : "pending"}
                  </span>
                  <span className="verification-note">
                    Workbench markup leaked: {clipboardAudit ? booleanWord(clipboardAudit.leakedWorkbenchMarkup) : "pending"}
                  </span>
                </div>
                <textarea
                  className="verification-textarea"
                  readOnly
                  value={clipboardAudit?.copiedText ?? ""}
                  placeholder="Audited clipboard plain text will appear here."
                />
                <textarea
                  className="projection-textarea"
                  readOnly
                  value={clipboardAudit?.copiedHtml ?? ""}
                  placeholder="Audited clipboard HTML will appear here for leak inspection."
                />
                {clipboardAudit?.leakedMarkers.length ? (
                  <p className="warning-inline">
                    Leaked markers: {clipboardAudit.leakedMarkers.join(", ")}
                  </p>
                ) : null}
              </section>
            </>
          ) : null}

          {activeTab === "anchors" ? (
            <>
              <section className="sidebar-section">
                <p className="section-kicker">Selection</p>
                <h2>Anchor capture</h2>
                <p className="section-copy">
                  Select a live range in the main editor, then capture it as either a boundary probe
                  or an annotation probe. The workbench stores one shared TextAnchor payload and
                  lets the repository remap or re-resolve it over time.
                </p>
                <div className="selection-card">
                  <span>From {mainSelection.from} to {mainSelection.to}</span>
                  <span>{mainSelection.empty ? "No active selection" : `${mainSelection.text.length} selected chars`}</span>
                </div>
                <textarea
                  className="projection-textarea"
                  readOnly
                  value={mainSelection.text}
                  placeholder="The selected text will appear here."
                />
                <input
                  className="text-input"
                  value={anchorLabel}
                  onChange={(event) => setAnchorLabel(event.target.value)}
                  placeholder="Optional probe label"
                />
                <div className="toolbar-actions">
                  <button className="secondary-button" onClick={() => void handleCreateAnchorProbe("boundary")} disabled={isBusy} type="button">
                    Add Boundary Probe
                  </button>
                  <button className="secondary-button" onClick={() => void handleCreateAnchorProbe("annotation")} disabled={isBusy} type="button">
                    Add Annotation Probe
                  </button>
                  <button className="primary-button" onClick={() => void handleRunAnchorScenarios()} disabled={isBusy} type="button">
                    Run Anchor Scenarios
                  </button>
                </div>
              </section>

              <section className="sidebar-section">
                <p className="section-kicker">Live Probes</p>
                <h2>Resolution state</h2>
                <div className="stack-list">
                  {anchorProbes.length === 0 ? (
                    <p className="empty-state">No anchor probes yet. Capture a real selection to start pressure-testing mapping and repair.</p>
                  ) : (
                    anchorProbes.map((probe) => (
                      <article key={probe.id} className={`stack-card stack-card--${probe.resolution.status}`}>
                        <div className="stack-card__meta">
                          <strong>{probe.label}</strong>
                          <span>{probe.kind}</span>
                        </div>
                        <p className="stack-card__copy">
                          {probe.resolution.status} at {probe.resolution.anchor.from}-{probe.resolution.anchor.to}
                        </p>
                        <p className="stack-card__copy">{probe.resolution.reason}</p>
                        <p className="stack-card__copy">{truncate(probe.anchor.exact, 96)}</p>
                        <button className="ghost-button" onClick={() => void handleDeleteAnchorProbe(probe.id)} type="button">
                          Delete probe
                        </button>
                      </article>
                    ))
                  )}
                </div>
              </section>

              <section className="sidebar-section">
                <p className="section-kicker">Scenario Output</p>
                <h2>Anchor proof runner</h2>
                <div className="stack-list">
                  {anchorScenario?.cases.length ? (
                    anchorScenario.cases.map((scenario) => (
                      <article key={scenario.id} className={`stack-card stack-card--${scenario.status}`}>
                        <div className="stack-card__meta">
                          <strong>{scenario.label}</strong>
                          <span>{scenario.status}</span>
                        </div>
                        <p className="stack-card__copy">{scenario.reason}</p>
                      </article>
                    ))
                  ) : (
                    <p className="empty-state">Run the scenario set to verify repaired, ambiguous, and invalid anchor outcomes.</p>
                  )}
                </div>
              </section>
            </>
          ) : null}

          {activeTab === "matching" ? (
            <>
              <section className="sidebar-section">
                <p className="section-kicker">Rule Engine</p>
                <h2>Visible-range matching</h2>
                <p className="section-copy">
                  Literal, alias, and bounded-regex rules compile against normalized text and only
                  run when overlays are enabled. The editor records visible-range timing so we can
                  see whether matching stays out of the typing hot path.
                </p>
                <div className="form-grid">
                  <input
                    className="text-input"
                    value={matchingForm.label}
                    onChange={(event) => setMatchingForm((current) => ({ ...current, label: event.target.value }))}
                    placeholder="Rule label"
                  />
                  <select
                    className="text-input"
                    value={matchingForm.kind}
                    onChange={(event) => setMatchingForm((current) => ({ ...current, kind: event.target.value as MatchingRuleKind }))}
                  >
                    <option value="literal">Literal</option>
                    <option value="alias">Alias</option>
                    <option value="regex">Bounded regex</option>
                  </select>
                  <input
                    className="text-input form-grid__wide"
                    value={matchingForm.pattern}
                    onChange={(event) => setMatchingForm((current) => ({ ...current, pattern: event.target.value }))}
                    placeholder="Pattern"
                  />
                </div>
                <label className="checkbox-row">
                  <input
                    checked={matchingForm.wholeWord}
                    onChange={(event) => setMatchingForm((current) => ({ ...current, wholeWord: event.target.checked }))}
                    type="checkbox"
                  />
                  Whole-word only
                </label>
                <label className="checkbox-row">
                  <input
                    checked={matchingForm.allowPossessive}
                    onChange={(event) => setMatchingForm((current) => ({ ...current, allowPossessive: event.target.checked }))}
                    type="checkbox"
                  />
                  Allow possessive
                </label>
                <label className="checkbox-row">
                  <input
                    checked={matchingForm.enabled}
                    onChange={(event) => setMatchingForm((current) => ({ ...current, enabled: event.target.checked }))}
                    type="checkbox"
                  />
                  Enabled on create
                </label>
                <div className="toolbar-actions">
                  <button className="primary-button" onClick={() => void handleSubmitMatchingRule()} disabled={isBusy} type="button">
                    Add Rule
                  </button>
                  <button className="secondary-button" onClick={() => void handleRunMatchingScenarios()} disabled={isBusy} type="button">
                    Run Matching Scenarios
                  </button>
                </div>
              </section>

              <section className="sidebar-section">
                <p className="section-kicker">Rules</p>
                <h2>Current compiled probes</h2>
                <div className="stack-list">
                  {matchingRules.length === 0 ? (
                    <p className="empty-state">Add a few literal, alias, or regex rules to see visible-range matching light up.</p>
                  ) : (
                    matchingRules.map((rule) => (
                      <article key={rule.id} className="stack-card stack-card--neutral">
                        <div className="stack-card__meta">
                          <strong>{rule.label}</strong>
                          <span>{rule.kind}</span>
                        </div>
                        <p className="stack-card__copy">{rule.pattern}</p>
                        <p className="stack-card__copy">
                          whole-word: {booleanWord(rule.wholeWord)} | possessive: {booleanWord(rule.allowPossessive)} | enabled: {booleanWord(rule.enabled)}
                        </p>
                        <div className="toolbar-actions">
                          <button className="ghost-button" onClick={() => void handleToggleMatchingRule(rule)} type="button">
                            {rule.enabled ? "Disable" : "Enable"}
                          </button>
                          <button className="ghost-button" onClick={() => void handleDeleteMatchingRule(rule.id)} type="button">
                            Delete
                          </button>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </section>

              <section className="sidebar-section">
                <p className="section-kicker">Benchmark</p>
                <h2>Visible-range timing</h2>
                <div className="selection-card">
                  <span>Overlays: {decorationsEnabled ? "enabled" : "disabled"}</span>
                  <span>
                    {lastMatchingBenchmark
                      ? `${roundNumber(lastMatchingBenchmark.recomputeMs)} ms / ${lastMatchingBenchmark.matchCount} hits`
                      : "No benchmark observed yet"}
                  </span>
                </div>
                <button className="secondary-button" onClick={() => void handleRecordMatchingBenchmark()} type="button">
                  Record Latest Benchmark
                </button>
                <div className="stack-list">
                  {matchingScenario?.cases.length ? (
                    matchingScenario.cases.map((scenario) => (
                      <article key={scenario.id} className={scenario.pass ? "stack-card stack-card--resolved" : "stack-card stack-card--invalid"}>
                        <div className="stack-card__meta">
                          <strong>{scenario.label}</strong>
                          <span>{scenario.pass ? "pass" : "fail"}</span>
                        </div>
                        <p className="stack-card__copy">
                          Matches: {scenario.matchLabels.length ? scenario.matchLabels.join(", ") : "none"}
                        </p>
                      </article>
                    ))
                  ) : (
                    <p className="empty-state">Run the matching scenarios to validate normalization, possessives, and regex probes.</p>
                  )}
                </div>
              </section>
            </>
          ) : null}

          {activeTab === "history" ? (
            <>
              <section className="sidebar-section">
                <p className="section-kicker">History Substrate</p>
                <h2>Replay, rebuild, restore</h2>
                <p className="section-copy">
                  Every document mutation appends steps and updates the head in one path. Use this
                  panel to checkpoint, replay a historical version, and run parity checks between
                  replayed projections and the live head.
                </p>
                <div className="import-note-grid">
                  <MetricCard label="Current Version" value={String(historySummary?.currentVersion ?? 0)} compact />
                  <MetricCard label="Steps" value={formatCount(historySummary?.stepCount ?? 0)} compact />
                  <MetricCard label="Events" value={formatCount(historySummary?.eventCount ?? 0)} compact />
                </div>
                <div className="toolbar-actions">
                  <button className="secondary-button" onClick={handleWriteCheckpoint} disabled={isBusy || !persistedSnapshot} type="button">
                    Save Checkpoint
                  </button>
                  <button className="secondary-button" onClick={() => void reloadPersistedHead("Reloaded the persisted head for history validation.")} disabled={isBusy} type="button">
                    Reload Head
                  </button>
                  <button className="primary-button" onClick={() => void handleRunHistoryScenario()} disabled={isBusy} type="button">
                    Run History Proof
                  </button>
                </div>
              </section>

              <section className="sidebar-section">
                <p className="section-kicker">Replay</p>
                <h2>Historical version</h2>
                <div className="toolbar-actions">
                  <input
                    className="text-input text-input--version"
                    value={replayVersion}
                    onChange={(event) => setReplayVersion(event.target.value)}
                    placeholder="Version"
                  />
                  <button className="secondary-button" onClick={() => void handleReplayDocument()} disabled={isBusy} type="button">
                    Replay
                  </button>
                  <button className="secondary-button" onClick={() => void handleRestoreReplay()} disabled={isBusy || !replayResult} type="button">
                    Restore Replay As Head
                  </button>
                </div>
                <textarea
                  className="projection-textarea"
                  readOnly
                  value={replayResult?.snapshot.plainText ?? ""}
                  placeholder="Replayed plain text will appear here."
                />
                <div className="stack-list">
                  {replayResult?.anchorResolutions.length ? (
                    replayResult.anchorResolutions.map((probe) => (
                      <article key={probe.id} className={`stack-card stack-card--${probe.resolution.status}`}>
                        <div className="stack-card__meta">
                          <strong>{probe.label}</strong>
                          <span>{probe.resolution.status}</span>
                        </div>
                        <p className="stack-card__copy">{probe.resolution.reason}</p>
                      </article>
                    ))
                  ) : (
                    <p className="empty-state">Replay a version to inspect historical anchor resolution states.</p>
                  )}
                </div>
              </section>

              <section className="sidebar-section">
                <p className="section-kicker">Parity Result</p>
                <h2>Projection rebuild</h2>
                {historyScenario ? (
                  <article className="stack-card stack-card--neutral">
                    <div className="stack-card__meta">
                      <strong>History proof</strong>
                      <span>v{historyScenario.currentVersion}</span>
                    </div>
                    <p className="stack-card__copy">
                      Replay matches head: {booleanWord(historyScenario.replayMatchesHead)}
                    </p>
                    <p className="stack-card__copy">
                      Rebuild matches head: {booleanWord(historyScenario.rebuildMatchesHead)}
                    </p>
                    <p className="stack-card__copy">
                      Checkpoints observed: {formatCount(historyScenario.checkpointCount)}
                    </p>
                  </article>
                ) : (
                  <p className="empty-state">Run the history proof to compare replay and rebuild parity against the current head.</p>
                )}
              </section>
            </>
          ) : null}

          {activeTab === "layout" ? (
            <>
              <section className="sidebar-section">
                <p className="section-kicker">Pretext Viability</p>
                <h2>DOM vs Pretext layout probe</h2>
                <p className="section-copy">
                  This compares the live editor surface against a Pretext pre-wrap measurement pass
                  using the editor&apos;s computed font and width. The goal is not pixel-perfect parity yet;
                  it is to learn whether Pretext is promising enough for document-view experiments.
                </p>
                <div className="toolbar-actions">
                  <button className="primary-button" onClick={() => void handleMeasureLayout()} disabled={isBusy || !liveSnapshot} type="button">
                    Measure Layout Probe
                  </button>
                </div>
                {layoutProbe ? (
                  <div className="stack-list">
                    <article className="stack-card stack-card--neutral">
                      <div className="stack-card__meta">
                        <strong>Decision</strong>
                        <span>{layoutDecisionLabel(layoutProbe.decision)}</span>
                      </div>
                      <p className="stack-card__copy">
                        DOM height {formatCount(layoutProbe.domHeight)} px vs Pretext height {formatCount(layoutProbe.pretextHeight)} px
                      </p>
                      <p className="stack-card__copy">
                        DOM visible blocks {formatCount(layoutProbe.domVisibleBlockCount)} | Pretext visible lines {formatCount(layoutProbe.pretextVisibleLineCount)}
                      </p>
                      <p className="stack-card__copy">
                        DOM {layoutProbe.domComputationMs} ms | Pretext {layoutProbe.pretextComputationMs} ms
                      </p>
                    </article>
                  </div>
                ) : (
                  <p className="empty-state">Run the layout probe after importing real prose to compare DOM measurements with Pretext.</p>
                )}
              </section>

              <section className="sidebar-section">
                <p className="section-kicker">Benchmarks</p>
                <h2>Recent proof records</h2>
                <div className="stack-list">
                  {workbenchState?.benchmarks.length ? (
                    workbenchState.benchmarks.map((benchmark) => (
                      <article key={benchmark.id} className="stack-card stack-card--neutral">
                        <div className="stack-card__meta">
                          <strong>{benchmark.category}</strong>
                          <span>{new Date(benchmark.createdAt).toLocaleTimeString()}</span>
                        </div>
                        <p className="stack-card__copy">{truncate(JSON.stringify(benchmark.payload), 120)}</p>
                      </article>
                    ))
                  ) : (
                    <p className="empty-state">Recorded clipboard, matching, and layout benchmarks will accumulate here.</p>
                  )}
                </div>
              </section>
            </>
          ) : null}

          <section className="sidebar-section">
            <p className="section-kicker">Run Log</p>
            <h2>Execution notes</h2>
            <div className="run-log">
              {runLog.length === 0 ? (
                <p className="empty-state">Workbench events will show up here as you import, edit, replay, and measure.</p>
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

function snapshotToEditorSnapshot(snapshot: StoredDocumentSnapshot): HarnessEditorSnapshot {
  return {
    contentJson: snapshot.contentJson,
    plainText: snapshot.plainText,
    metrics: collectDocumentMetrics(snapshot.plainText),
  };
}

function MetricCard(props: { label: string; value: string; compact?: boolean }) {
  return (
    <article className={props.compact ? "metric-card metric-card--compact" : "metric-card"}>
      <span className="metric-label">{props.label}</span>
      <strong className="metric-value">{props.value}</strong>
    </article>
  );
}

function measureDomLayout(host: HTMLDivElement): {
  domHeight: number;
  domVisibleBlockCount: number;
  domComputationMs: number;
  textWidth: number;
  lineHeight: number;
  font: string;
  scrollTop: number;
  viewportHeight: number;
} | null {
  const surface = host.querySelector(".editor-surface") as HTMLDivElement | null;
  const editorRoot = host.querySelector(".editor-prosemirror") as HTMLDivElement | null;
  if (!surface || !editorRoot) {
    return null;
  }

  const startedAt = performance.now();
  const surfaceRect = surface.getBoundingClientRect();
  const blocks = [...editorRoot.children] as HTMLElement[];
  const visibleBlockCount = blocks.reduce((count, block) => {
    const rect = block.getBoundingClientRect();
    if (rect.bottom < surfaceRect.top || rect.top > surfaceRect.bottom) {
      return count;
    }
    return count + 1;
  }, 0);
  const styles = window.getComputedStyle(editorRoot);
  const paddingLeft = Number.parseFloat(styles.paddingLeft) || 0;
  const paddingRight = Number.parseFloat(styles.paddingRight) || 0;
  const lineHeight = Number.parseFloat(styles.lineHeight) || 30;

  return {
    domHeight: editorRoot.scrollHeight,
    domVisibleBlockCount: visibleBlockCount,
    domComputationMs: performance.now() - startedAt,
    textWidth: Math.max(120, editorRoot.clientWidth - paddingLeft - paddingRight),
    lineHeight,
    font: styles.font || "400 17px Georgia, serif",
    scrollTop: surface.scrollTop,
    viewportHeight: surface.clientHeight,
  };
}

function measurePretextLayout(
  plainText: string,
  font: string,
  width: number,
  lineHeight: number,
  scrollTop: number,
  viewportHeight: number,
): {
  pretextHeight: number;
  pretextLineCount: number;
  pretextVisibleLineCount: number;
  pretextComputationMs: number;
} {
  const startedAt = performance.now();
  const prepared = prepareWithSegments(plainText, font, { whiteSpace: "pre-wrap" });
  const layoutResult = layout(prepared, width, lineHeight);
  const lineStats = measureLineStats(prepared, width);
  const viewportTop = scrollTop;
  const viewportBottom = scrollTop + viewportHeight;
  let visibleLineCount = 0;
  let index = 0;

  walkLineRanges(prepared, width, () => {
    const lineTop = index * lineHeight;
    const lineBottom = lineTop + lineHeight;
    if (lineBottom >= viewportTop && lineTop <= viewportBottom) {
      visibleLineCount += 1;
    }
    index += 1;
  });

  return {
    pretextHeight: layoutResult.height,
    pretextLineCount: lineStats.lineCount,
    pretextVisibleLineCount: visibleLineCount,
    pretextComputationMs: performance.now() - startedAt,
  };
}

function decideLayoutPath(domHeight: number, pretextHeight: number): LayoutDecision {
  if (domHeight <= 0) {
    return "keep-as-future-option";
  }

  const drift = Math.abs(domHeight - pretextHeight) / domHeight;
  if (drift <= 0.08) {
    return "adopt-document-view-only";
  }
  if (drift <= 0.18) {
    return "keep-as-future-option";
  }
  return "reject-for-now";
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function roundNumber(value: number): number {
  return Math.round(value * 100) / 100;
}

function layoutDecisionLabel(decision: LayoutDecision): string {
  if (decision === "adopt-document-view-only") {
    return "Adopt for document view";
  }
  if (decision === "keep-as-future-option") {
    return "Keep as future option";
  }
  return "Reject for now";
}

function auditPillClassName(audit: ClipboardAuditResult): string {
  return audit.copiedTextMatchesPersistedPlainText && !audit.leakedWorkbenchMarkup
    ? "verification-pill verification-pill--success"
    : "verification-pill verification-pill--warn";
}

function booleanWord(value: boolean): string {
  return value ? "yes" : "no";
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

function defaultAnchorLabel(kind: AnchorProbeKind, index: number): string {
  return `${kind === "boundary" ? "Boundary" : "Annotation"} probe ${index}`;
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
