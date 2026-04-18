import type {
  JsonObject,
  StoredDocumentSnapshot,
} from "./document";

export type AnchorProbeKind = "boundary" | "annotation";
export type AnchorResolutionStatus = "resolved" | "repaired" | "ambiguous" | "invalid";
export type MatchingRuleKind = "literal" | "alias" | "regex";
export type BenchmarkCategory = "matching" | "history" | "layout" | "anchor" | "clipboard";
export type LayoutDecision = "adopt-document-view-only" | "keep-as-future-option" | "reject-for-now";

export type TextAnchor = {
  documentId: string;
  from: number;
  to: number;
  exact: string;
  prefix: string;
  suffix: string;
  blockPath: number[];
  approxPlainTextOffset?: number;
  versionSeen: number;
};

export type AnchorResolutionResult = {
  status: AnchorResolutionStatus;
  reason: string;
  anchor: TextAnchor;
};

export type AnchorProbeRecord = {
  id: string;
  kind: AnchorProbeKind;
  label: string;
  anchor: TextAnchor;
  resolution: AnchorResolutionResult;
  updatedAt: string;
};

export type CreateAnchorProbeInput = {
  kind: AnchorProbeKind;
  label: string;
  anchor: TextAnchor;
};

export type DeleteAnchorProbeInput = {
  probeId: string;
};

export type MatchingRuleRecord = {
  id: string;
  label: string;
  kind: MatchingRuleKind;
  pattern: string;
  wholeWord: boolean;
  allowPossessive: boolean;
  enabled: boolean;
  updatedAt: string;
};

export type UpsertMatchingRuleInput = {
  id?: string;
  label: string;
  kind: MatchingRuleKind;
  pattern: string;
  wholeWord: boolean;
  allowPossessive: boolean;
  enabled: boolean;
};

export type DeleteMatchingRuleInput = {
  ruleId: string;
};

export type NormalizedRule = {
  id: string;
  label: string;
  kind: MatchingRuleKind;
  raw: string;
  normalized: string;
  wholeWord: boolean;
  allowPossessive: boolean;
  enabled: boolean;
};

export type MatchHit = {
  ruleId: string;
  label: string;
  from: number;
  to: number;
  matchedText: string;
  normalizedText: string;
};

export type MatchingBenchmark = {
  visibleFrom: number;
  visibleTo: number;
  visibleCharacterCount: number;
  matchCount: number;
  recomputeMs: number;
  ruleCount: number;
  highlightingEnabled: boolean;
  createdAt: string;
};

export type DocumentStepRow = {
  id: string;
  documentId: string;
  version: number;
  stepJson: string;
  inverseStepJson: string;
  createdAt: string;
};

export type DocumentCheckpointRow = {
  documentId: string;
  version: number;
  contentFormat: string;
  contentSchemaVersion: number;
  contentJson: string;
  plainText: string;
  label: string | null;
  createdAt: string;
};

export type EventRow = {
  id: string;
  aggregateType: string;
  aggregateId: string;
  aggregateSeq: number;
  eventType: string;
  eventVersion: number;
  payloadJson: string;
  createdAt: string;
};

export type ClipboardAuditResult = {
  copiedText: string;
  copiedHtml: string;
  copiedTextMatchesPersistedPlainText: boolean;
  richHtmlPresent: boolean;
  leakedWorkbenchMarkup: boolean;
  leakedMarkers: string[];
};

export type LayoutProbeResult = {
  width: number;
  lineHeight: number;
  domHeight: number;
  domVisibleBlockCount: number;
  domComputationMs: number;
  pretextHeight: number;
  pretextLineCount: number;
  pretextVisibleLineCount: number;
  pretextComputationMs: number;
  decision: LayoutDecision;
  createdAt: string;
};

export type BenchmarkRecord = {
  id: string;
  category: BenchmarkCategory;
  payload: JsonObject;
  createdAt: string;
};

export type HistoryReplayResult = {
  snapshot: StoredDocumentSnapshot;
  anchorResolutions: AnchorProbeRecord[];
};

export type HistorySummary = {
  currentVersion: number;
  stepCount: number;
  checkpointCount: number;
  eventCount: number;
};

export type ApplyDocumentTransactionInput = {
  documentId: string;
  baseVersion: number;
  title: string;
  steps: JsonObject[];
  inverseSteps: JsonObject[];
  contentJson: JsonObject;
  plainText: string;
  saveIntent?: boolean;
};

export type ApplyDocumentTransactionResult = {
  snapshot: StoredDocumentSnapshot;
  historySummary: HistorySummary;
  anchorProbes: AnchorProbeRecord[];
};

export type ReplaceDocumentHeadInput = {
  documentId: string;
  title: string;
  contentJson: JsonObject;
  plainText: string;
  source: "import-slot" | "small-fixture" | "replay-restore";
};

export type WorkbenchStatus = {
  dbPath: string;
  documentId: string;
  contentFormat: string;
  contentSchemaVersion: number;
  synchronousMode: "FULL" | "NORMAL";
  storageEngine: string;
};

export type WorkbenchState = {
  snapshot: StoredDocumentSnapshot | null;
  anchorProbes: AnchorProbeRecord[];
  matchingRules: MatchingRuleRecord[];
  historySummary: HistorySummary;
  benchmarks: BenchmarkRecord[];
};

export type AnchorScenarioCase = {
  id: string;
  label: string;
  status: AnchorResolutionStatus;
  reason: string;
};

export type AnchorScenarioRun = {
  ranAt: string;
  cases: AnchorScenarioCase[];
};

export type MatchingScenarioResult = {
  ranAt: string;
  cases: Array<{
    id: string;
    label: string;
    pass: boolean;
    matchLabels: string[];
  }>;
};

export type HistoryScenarioResult = {
  ranAt: string;
  replayMatchesHead: boolean;
  rebuildMatchesHead: boolean;
  currentVersion: number;
  checkpointCount: number;
};
