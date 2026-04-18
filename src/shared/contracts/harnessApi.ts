import type { JsonObject } from "../domain/document";
import type {
  AnchorProbeRecord,
  AnchorScenarioRun,
  ApplyDocumentTransactionInput,
  ApplyDocumentTransactionResult,
  BenchmarkCategory,
  BenchmarkRecord,
  CreateAnchorProbeInput,
  DeleteAnchorProbeInput,
  DeleteMatchingRuleInput,
  HistoryReplayResult,
  HistoryScenarioResult,
  MatchingRuleRecord,
  MatchingScenarioResult,
  ReplaceDocumentHeadInput,
  UpsertMatchingRuleInput,
  WorkbenchState,
  WorkbenchStatus,
} from "../domain/workbench";

export const HARNESS_CHANNELS = {
  getStatus: "workbench:get-status",
  loadState: "workbench:load-state",
  replaceDocumentHead: "workbench:replace-document-head",
  applyDocumentTransaction: "workbench:apply-document-transaction",
  writeCheckpoint: "workbench:write-checkpoint",
  createAnchorProbe: "workbench:create-anchor-probe",
  deleteAnchorProbe: "workbench:delete-anchor-probe",
  upsertMatchingRule: "workbench:upsert-matching-rule",
  deleteMatchingRule: "workbench:delete-matching-rule",
  replayDocumentToVersion: "workbench:replay-document-to-version",
  rebuildProjectionsFromHistory: "workbench:rebuild-projections-from-history",
  recordBenchmark: "workbench:record-benchmark",
  loadSmallFixture: "workbench:load-small-fixture",
  runAnchorScenarios: "workbench:run-anchor-scenarios",
  runMatchingScenarios: "workbench:run-matching-scenarios",
  runHistoryScenario: "workbench:run-history-scenario",
  readClipboardText: "workbench:read-clipboard-text",
  readClipboardHtml: "workbench:read-clipboard-html",
  clearClipboard: "workbench:clear-clipboard",
} as const;

export interface HarnessBridge {
  getStatus(): Promise<WorkbenchStatus>;
  loadState(): Promise<WorkbenchState>;
  replaceDocumentHead(input: ReplaceDocumentHeadInput): Promise<WorkbenchState>;
  applyDocumentTransaction(input: ApplyDocumentTransactionInput): Promise<ApplyDocumentTransactionResult>;
  writeCheckpoint(label: string | null): Promise<void>;
  createAnchorProbe(input: CreateAnchorProbeInput): Promise<AnchorProbeRecord>;
  deleteAnchorProbe(input: DeleteAnchorProbeInput): Promise<AnchorProbeRecord[]>;
  upsertMatchingRule(input: UpsertMatchingRuleInput): Promise<MatchingRuleRecord[]>;
  deleteMatchingRule(input: DeleteMatchingRuleInput): Promise<MatchingRuleRecord[]>;
  replayDocumentToVersion(targetVersion: number): Promise<HistoryReplayResult>;
  rebuildProjectionsFromHistory(): Promise<HistoryScenarioResult>;
  recordBenchmark(category: BenchmarkCategory, payload: JsonObject): Promise<BenchmarkRecord>;
  loadSmallFixture(): Promise<WorkbenchState>;
  runAnchorScenarios(): Promise<AnchorScenarioRun>;
  runMatchingScenarios(): Promise<MatchingScenarioResult>;
  runHistoryScenario(): Promise<HistoryScenarioResult>;
  readClipboardText(): Promise<string>;
  readClipboardHtml(): Promise<string>;
  clearClipboard(): Promise<void>;
}
