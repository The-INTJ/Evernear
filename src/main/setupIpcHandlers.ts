// Registers every IPC channel from HARNESS_CHANNELS. Extracted from
// main/index.ts so that file stays at the app-bootstrap layer (window,
// app lifecycle, persistence init) and does not grow unbounded as new
// channels land.
//
// Every ipcMain.handle wraps its payload in parseInput — that's the
// trust boundary. Repositories can assume well-formed domain types.

import { clipboard, ipcMain } from "electron";

import { WorkspaceRepository } from "../db/repositories/WorkspaceRepository";
import { HARNESS_CHANNELS } from "../shared/contracts/harnessApi";
import {
  ApplyDocumentTransactionInputSchema,
  ClosePaneInputSchema,
  CreatePaneInputSchema,
  CreateDocumentInputSchema,
  CreateEntityInputSchema,
  CreateFolderInputSchema,
  CreateProjectInputSchema,
  CreateSliceInputSchema,
  DeleteDocumentInputSchema,
  DeleteEntityInputSchema,
  DeleteFolderInputSchema,
  DeleteMatchingRuleInputSchema,
  DeleteSliceInputSchema,
  FocusPaneInputSchema,
  MovePaneInputSchema,
  UpdateSliceBoundaryInputSchema,
  OpenDocumentInputSchema,
  OpenProjectInputSchema,
  ReorderDocumentInputSchema,
  PopPaneContentInputSchema,
  PopOutPaneInputSchema,
  PushPaneContentInputSchema,
  ReplacePaneContentInputSchema,
  ReplayDocumentArgsSchema,
  UpdateDocumentMetaInputSchema,
  UpdateEntityInputSchema,
  UpdateFolderInputSchema,
  UpdateLayoutInputSchema,
  UpdatePaneInputSchema,
  UpdateProjectInputSchema,
  UpsertMatchingRuleInputSchema,
  WriteCheckpointArgsSchema,
  parseInput,
} from "../shared/contracts/harnessSchemas";
import type { WorkspaceState, WorkspaceStatus } from "../shared/domain/workspace";

export function setupIpcHandlers(
  repository: WorkspaceRepository,
  getStatus: () => WorkspaceStatus,
  popOutPane?: (paneId: string) => Promise<WorkspaceState> | WorkspaceState,
): void {
  const C = HARNESS_CHANNELS;

  ipcMain.handle(C.getStatus, () => getStatus());
  ipcMain.handle(C.loadWorkspace, () => repository.loadWorkspace());

  ipcMain.handle(C.createProject, (_event, input) =>
    repository.createProject(parseInput(CreateProjectInputSchema, input, C.createProject)));
  ipcMain.handle(C.updateProject, (_event, input) =>
    repository.updateProject(parseInput(UpdateProjectInputSchema, input, C.updateProject)));
  ipcMain.handle(C.openProject, (_event, input) =>
    repository.openProject(parseInput(OpenProjectInputSchema, input, C.openProject)));

  ipcMain.handle(C.createFolder, (_event, input) =>
    repository.createFolder(parseInput(CreateFolderInputSchema, input, C.createFolder)));
  ipcMain.handle(C.updateFolder, (_event, input) =>
    repository.updateFolder(parseInput(UpdateFolderInputSchema, input, C.updateFolder)));
  ipcMain.handle(C.deleteFolder, (_event, input) =>
    repository.deleteFolder(parseInput(DeleteFolderInputSchema, input, C.deleteFolder)));

  ipcMain.handle(C.createDocument, (_event, input) =>
    repository.createDocument(parseInput(CreateDocumentInputSchema, input, C.createDocument)));
  ipcMain.handle(C.updateDocumentMeta, (_event, input) =>
    repository.updateDocumentMeta(parseInput(UpdateDocumentMetaInputSchema, input, C.updateDocumentMeta)));
  ipcMain.handle(C.deleteDocument, (_event, input) =>
    repository.deleteDocument(parseInput(DeleteDocumentInputSchema, input, C.deleteDocument)));
  ipcMain.handle(C.reorderDocument, (_event, input) =>
    repository.reorderDocument(parseInput(ReorderDocumentInputSchema, input, C.reorderDocument)));
  ipcMain.handle(C.openDocument, (_event, input) =>
    repository.openDocument(parseInput(OpenDocumentInputSchema, input, C.openDocument)));

  ipcMain.handle(C.updateLayout, (_event, input) =>
    repository.updateLayout(parseInput(UpdateLayoutInputSchema, input, C.updateLayout)));

  ipcMain.handle(C.createPane, (_event, input) =>
    repository.createPane(parseInput(CreatePaneInputSchema, input, C.createPane)));
  ipcMain.handle(C.updatePane, (_event, input) =>
    repository.updatePane(parseInput(UpdatePaneInputSchema, input, C.updatePane)));
  ipcMain.handle(C.closePane, (_event, input) =>
    repository.closePane(parseInput(ClosePaneInputSchema, input, C.closePane)));
  ipcMain.handle(C.focusPane, (_event, input) =>
    repository.focusPane(parseInput(FocusPaneInputSchema, input, C.focusPane)));
  ipcMain.handle(C.replacePaneContent, (_event, input) =>
    repository.replacePaneContent(parseInput(ReplacePaneContentInputSchema, input, C.replacePaneContent)));
  ipcMain.handle(C.pushPaneContent, (_event, input) =>
    repository.pushPaneContent(parseInput(PushPaneContentInputSchema, input, C.pushPaneContent)));
  ipcMain.handle(C.popPaneContent, (_event, input) =>
    repository.popPaneContent(parseInput(PopPaneContentInputSchema, input, C.popPaneContent)));
  ipcMain.handle(C.movePane, (_event, input) =>
    repository.movePane(parseInput(MovePaneInputSchema, input, C.movePane)));
  ipcMain.handle(C.popOutPane, (_event, input) => {
    const parsed = parseInput(PopOutPaneInputSchema, input, C.popOutPane);
    return popOutPane ? popOutPane(parsed.paneId) : repository.loadWorkspace();
  });

  ipcMain.handle(C.applyDocumentTransaction, (_event, input) =>
    repository.applyDocumentTransaction(parseInput(ApplyDocumentTransactionInputSchema, input, C.applyDocumentTransaction)));

  ipcMain.handle(C.createEntity, (_event, input) =>
    repository.createEntity(parseInput(CreateEntityInputSchema, input, C.createEntity)));
  ipcMain.handle(C.updateEntity, (_event, input) =>
    repository.updateEntity(parseInput(UpdateEntityInputSchema, input, C.updateEntity)));
  ipcMain.handle(C.deleteEntity, (_event, input) =>
    repository.deleteEntity(parseInput(DeleteEntityInputSchema, input, C.deleteEntity)));

  ipcMain.handle(C.upsertMatchingRule, (_event, input) =>
    repository.upsertMatchingRule(parseInput(UpsertMatchingRuleInputSchema, input, C.upsertMatchingRule)));
  ipcMain.handle(C.deleteMatchingRule, (_event, input) =>
    repository.deleteMatchingRule(parseInput(DeleteMatchingRuleInputSchema, input, C.deleteMatchingRule)));

  ipcMain.handle(C.createSlice, (_event, input) =>
    repository.createSlice(parseInput(CreateSliceInputSchema, input, C.createSlice)));
  ipcMain.handle(C.deleteSlice, (_event, input) =>
    repository.deleteSlice(parseInput(DeleteSliceInputSchema, input, C.deleteSlice)));
  ipcMain.handle(C.updateSliceBoundary, (_event, input) =>
    repository.updateSliceBoundary(parseInput(UpdateSliceBoundaryInputSchema, input, C.updateSliceBoundary)));

  ipcMain.handle(C.writeCheckpoint, (_event, documentId, label) => {
    const [id, lbl] = parseInput(WriteCheckpointArgsSchema, [documentId, label], C.writeCheckpoint);
    repository.writeCheckpoint(id, lbl);
  });
  ipcMain.handle(C.replayDocumentToVersion, (_event, documentId, targetVersion) => {
    const [id, version] = parseInput(ReplayDocumentArgsSchema, [documentId, targetVersion], C.replayDocumentToVersion);
    return repository.replayDocumentToVersion(id, version);
  });

  // Clipboard passthroughs — no repository, no validation needed.
  ipcMain.handle(C.readClipboardText, () => clipboard.readText());
  ipcMain.handle(C.readClipboardHtml, () => clipboard.readHTML());
  ipcMain.handle(C.clearClipboard, () => {
    clipboard.clear();
  });
}
