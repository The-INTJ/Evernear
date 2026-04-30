// Runtime input validators for the IPC contract.
//
// TypeScript's type system stops at the process boundary: `HarnessBridge`
// declares the shape of each method's input, but what actually arrives over
// ipcRenderer is `unknown`. A bug in the renderer — or a malicious payload
// from a compromised preload — could hand main a malformed object, and
// the repository layer would execute a SQL INSERT on garbage.
//
// These schemas are the trust boundary. Main validates every channel's
// input with the matching schema before calling into WorkspaceRepository.
// If validation fails, the IPC call throws (rendering as a rejected
// Promise to the renderer); the DB is never touched.
//
// When adding a new IPC method:
//   1. Add its input type to shared/domain/workspace.ts.
//   2. Add its Zod schema here (colocated with the type).
//   3. Register the validator in main/index.ts alongside the handler.

import { z } from "zod";

import type { JsonObject, JsonValue } from "../domain/document";

// ──────────────── small reusable pieces ────────────────

const NonEmptyString = z.string().min(1);

const TextAnchorSchema = z.object({
  documentId: NonEmptyString,
  from: z.number().int().nonnegative(),
  to: z.number().int().nonnegative(),
  exact: z.string(),
  prefix: z.string(),
  suffix: z.string(),
  blockPath: z.array(z.number().int().nonnegative()),
  approxPlainTextOffset: z.number().int().optional(),
  versionSeen: z.number().int().nonnegative(),
});

// JSON content values — loose on purpose. The repository persists this
// as a string; ProseMirror will reject invalid documents when the content
// gets rehydrated on the next load, which is the right failure domain.
// Typed as JsonValue / JsonObject so z.infer aligns with the domain type
// without forcing us to crawl the ProseMirror schema here.
const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(z.string(), JsonValueSchema),
  ]),
);
const JsonObjectSchema: z.ZodType<JsonObject> = z.record(z.string(), JsonValueSchema);

// ──────────────── project ────────────────

export const CreateProjectInputSchema = z.object({
  name: z.string(),
});

export const UpdateProjectInputSchema = z.object({
  projectId: NonEmptyString,
  name: z.string(),
});

export const OpenProjectInputSchema = z.object({
  projectId: NonEmptyString,
});

// ──────────────── folder ────────────────

export const CreateFolderInputSchema = z.object({
  projectId: NonEmptyString,
  title: z.string(),
  parentFolderId: z.string().nullable().optional(),
});

export const UpdateFolderInputSchema = z.object({
  folderId: NonEmptyString,
  title: z.string(),
});

export const DeleteFolderInputSchema = z.object({
  folderId: NonEmptyString,
});

// ──────────────── document ────────────────

export const CreateDocumentInputSchema = z.object({
  projectId: NonEmptyString,
  folderId: z.string().nullable(),
  title: z.string(),
  openInPanel: z.boolean().optional(),
});

export const UpdateDocumentMetaInputSchema = z.object({
  documentId: NonEmptyString,
  title: z.string().optional(),
  folderId: z.string().nullable().optional(),
});

export const DeleteDocumentInputSchema = z.object({
  documentId: NonEmptyString,
});

export const ReorderDocumentInputSchema = z.object({
  documentId: NonEmptyString,
  direction: z.enum(["up", "down"]),
});

export const MoveFolderInputSchema = z.object({
  folderId: NonEmptyString,
  newParentFolderId: z.string().nullable(),
  beforeFolderId: z.string().nullable(),
});

export const MoveDocumentInputSchema = z.object({
  documentId: NonEmptyString,
  newFolderId: z.string().nullable(),
  beforeDocumentId: z.string().nullable(),
});

export const OpenDocumentInputSchema = z.object({
  documentId: NonEmptyString,
  surface: z.enum(["main", "panel"]),
});

// ──────────────── layout ────────────────

export const PanelModeSchema = z.enum(["entities", "chooser", "placement", "document"]);

export const UpdateLayoutInputSchema = z.object({
  activeProjectId: z.string().nullable().optional(),
  activeDocumentId: z.string().nullable().optional(),
  panelDocumentId: z.string().nullable().optional(),
  selectedEntityId: z.string().nullable().optional(),
  expandedFolderIds: z.array(z.string()).optional(),
  highlightsEnabled: z.boolean().optional(),
  panelOpen: z.boolean().optional(),
  panelMode: PanelModeSchema.optional(),
  lastFocusedDocumentId: z.string().nullable().optional(),
  recentTargetDocumentIds: z.array(z.string()).optional(),
}).strict();

// ──────────────── document transaction ────────────────

export const ApplyDocumentTransactionInputSchema = z.object({
  documentId: NonEmptyString,
  baseVersion: z.number().int().nonnegative(),
  title: z.string(),
  steps: z.array(JsonObjectSchema),
  inverseSteps: z.array(JsonObjectSchema),
  contentJson: JsonObjectSchema,
  plainText: z.string(),
  saveIntent: z.boolean().optional(),
});

// ──────────────── entity ────────────────

export const CreateEntityInputSchema = z.object({
  projectId: NonEmptyString,
  name: z.string(),
});

export const UpdateEntityInputSchema = z.object({
  entityId: NonEmptyString,
  name: z.string(),
});

export const DeleteEntityInputSchema = z.object({
  entityId: NonEmptyString,
});

export const MatchingRuleKindSchema = z.enum(["literal", "alias", "regex"]);

export const UpsertMatchingRuleInputSchema = z.object({
  id: z.string().optional(),
  entityId: NonEmptyString,
  label: z.string(),
  kind: MatchingRuleKindSchema,
  pattern: z.string(),
  wholeWord: z.boolean(),
  allowPossessive: z.boolean(),
  enabled: z.boolean(),
});

export const DeleteMatchingRuleInputSchema = z.object({
  ruleId: NonEmptyString,
});

// ──────────────── slice ────────────────

export const CreateSliceInputSchema = z.object({
  projectId: NonEmptyString,
  entityId: NonEmptyString,
  documentId: NonEmptyString,
  title: z.string(),
  anchor: TextAnchorSchema,
});

export const DeleteSliceInputSchema = z.object({
  sliceId: NonEmptyString,
});

export const UpdateSliceBoundaryInputSchema = z.object({
  boundaryId: NonEmptyString,
  anchor: TextAnchorSchema,
});

// ──────────────── history ────────────────

export const WriteCheckpointArgsSchema = z.tuple([NonEmptyString, z.string().nullable()]);
export const ReplayDocumentArgsSchema = z.tuple([NonEmptyString, z.number().int().nonnegative()]);

// ──────────────── helper for handlers ────────────────

// Wrap a parsed result so main can throw a meaningful IPC error rather
// than a Zod stacktrace. Keep the message short; the renderer just sees
// the thrown string in the rejected Promise.
export function parseInput<T extends z.ZodTypeAny>(schema: T, value: unknown, channel: string): z.output<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new Error(
      `Invalid IPC payload for ${channel}: ${result.error.issues
        .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
        .join("; ")}`,
    );
  }
  return result.data;
}
