// Renderer-only session types. These model short-lived UI state flows
// (Everlink creation, slice placement, hover preview, run log, matching-rule
// form) that don't live in the persisted workspace and aren't part of the
// IPC contract. Colocated here so hooks and feature components both
// reference one source without tempting App.tsx to redeclare them.

import type { MatchingRuleKind } from "../../shared/domain/workspace";
import type { EditorSelectionInfo } from "../editor/workbenchUtils";

export type RunLogTone = "info" | "success" | "warn";

export type RunLogEntry = {
  id: number;
  message: string;
  tone: RunLogTone;
  createdAt: string;
};

export type RuleFormState = {
  label: string;
  pattern: string;
  kind: MatchingRuleKind;
  wholeWord: boolean;
  allowPossessive: boolean;
  enabled: boolean;
};

export const initialRuleForm: RuleFormState = {
  label: "",
  pattern: "",
  kind: "literal",
  wholeWord: true,
  allowPossessive: true,
  enabled: true,
};

export type EverlinkSession = {
  sourceDocumentId: string;
  sourceSelection: EditorSelectionInfo;
  sourceText: string;
  selectedEntityId: string | null;
  entityNameDraft: string;
  targetDocumentId: string | null;
  newTargetDocumentTitle: string;
  ruleKind: MatchingRuleKind;
  mode: "create" | "attach" | "edit";
};

export type PendingSlicePlacement = {
  entityId: string;
  sourceDocumentId: string;
  sourceText: string;
  targetDocumentId: string;
  surface: "main" | "panel";
  start: number | null;
  end: number | null;
};

export type HoverPreview = {
  entityId: string;
  x: number;
  y: number;
};
