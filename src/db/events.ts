// Typed event catalog.
//
// The domain event log (events table) is append-only and load-bearing for
// rebuild-from-history. Every mutation in every repository appends one row.
// Previously event names were inline string literals at each call site; now
// they're a closed union so misspellings and drift are compile errors.
//
// When adding a new event:
//   1. Add a line to EVENT_TYPES.
//   2. Add its payload shape to EventPayloadMap.
//   3. Use HistoryRepository.appendEvent(aggregate, id, TYPE, version, payload).
//
// Do not inline new string literals in repositories.

import type { AnchorResolutionStatus, MatchingRuleKind } from "../shared/domain/workspace";

export const EVENT_AGGREGATE_TYPES = {
  project: "project",
  folder: "folder",
  document: "document",
  entity: "entity",
  matchingRule: "matchingRule",
  slice: "slice",
  sliceBoundary: "sliceBoundary",
} as const;

export type EventAggregateType = (typeof EVENT_AGGREGATE_TYPES)[keyof typeof EVENT_AGGREGATE_TYPES];

export const EVENT_TYPES = {
  projectCreated: "projectCreated",
  projectUpdated: "projectUpdated",

  folderCreated: "folderCreated",
  folderUpdated: "folderUpdated",
  folderDeleted: "folderDeleted",

  documentCreated: "documentCreated",
  documentMetaUpdated: "documentMetaUpdated",
  documentDeleted: "documentDeleted",

  entityCreated: "entityCreated",
  entityUpdated: "entityUpdated",
  entityDeleted: "entityDeleted",

  matchingRuleCreated: "matchingRuleCreated",
  matchingRuleUpdated: "matchingRuleUpdated",

  sliceCreated: "sliceCreated",
  sliceBoundaryAutoResolved: "sliceBoundaryAutoResolved",
  sliceBoundaryManuallyMoved: "sliceBoundaryManuallyMoved",
} as const;

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];

export type EventPayloadMap = {
  projectCreated: { name: string };
  projectUpdated: { name: string };

  folderCreated: { title: string };
  folderUpdated: { title: string };
  folderDeleted: { title: string };

  documentCreated: { title: string; folderId: string | null };
  documentMetaUpdated: { title: string; folderId: string | null };
  documentDeleted: { title: string };

  entityCreated: { name: string };
  entityUpdated: { name: string };
  entityDeleted: { name: string };

  matchingRuleCreated: {
    entityId: string;
    label: string;
    kind: MatchingRuleKind;
    pattern: string;
  };
  matchingRuleUpdated: {
    entityId: string;
    label: string;
    kind: MatchingRuleKind;
    pattern: string;
  };

  sliceCreated: {
    entityId: string;
    title: string;
    documentId: string;
  };
  sliceBoundaryAutoResolved: {
    sliceId: string;
    status: AnchorResolutionStatus;
    reason: string;
  };
  sliceBoundaryManuallyMoved: {
    sliceId: string;
    status: AnchorResolutionStatus;
    reason: string;
  };
};

export type EventPayload<T extends EventType> = EventPayloadMap[T];
