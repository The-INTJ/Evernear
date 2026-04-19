import path from "node:path";

import { app, BrowserWindow, clipboard, ipcMain } from "electron";

import { SqliteHarness } from "../db/sqliteHarness";
import { WorkspaceRepository } from "../db/repositories/WorkspaceRepository";
import { HARNESS_CONTENT_FORMAT, HARNESS_CONTENT_SCHEMA_VERSION } from "../shared/domain/document";
import { HARNESS_CHANNELS } from "../shared/contracts/harnessApi";
import {
  ApplyDocumentTransactionInputSchema,
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
  UpdateSliceBoundaryInputSchema,
  OpenDocumentInputSchema,
  OpenProjectInputSchema,
  ReorderDocumentInputSchema,
  ReplayDocumentArgsSchema,
  UpdateDocumentMetaInputSchema,
  UpdateEntityInputSchema,
  UpdateFolderInputSchema,
  UpdateLayoutInputSchema,
  UpdateProjectInputSchema,
  UpsertMatchingRuleInputSchema,
  WriteCheckpointArgsSchema,
  parseInput,
} from "../shared/contracts/harnessSchemas";
import type { WorkspaceStatus } from "../shared/domain/workspace";

const rendererUrl = process.env.EVERNEAR_RENDERER_URL;

let mainWindow: BrowserWindow | null = null;
let repository: WorkspaceRepository;
let workspaceStatus: WorkspaceStatus;

async function bootstrapPersistence(): Promise<void> {
  const runtimeRoot = process.cwd();
  const dbPath = path.join(runtimeRoot, ".local", "phase-1-harness.sqlite");
  const sqliteHarness = SqliteHarness.open(dbPath, "FULL");

  repository = new WorkspaceRepository(sqliteHarness);
  repository.ensureWorkspaceState();

  workspaceStatus = {
    dbPath,
    contentFormat: HARNESS_CONTENT_FORMAT,
    contentSchemaVersion: HARNESS_CONTENT_SCHEMA_VERSION,
    synchronousMode: sqliteHarness.synchronousMode,
    storageEngine: "better-sqlite3",
  };
}

// Every ipcMain.handle wraps its payload in parseInput — that's the
// trust boundary. Repositories can assume well-formed domain types.
function registerIpcHandlers(): void {
  const C = HARNESS_CHANNELS;

  ipcMain.handle(C.getStatus, () => workspaceStatus);
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

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1520,
    height: 980,
    minWidth: 1240,
    minHeight: 760,
    backgroundColor: "#0e1820",
    title: "Evernear",
    // Custom chrome: hide the OS frame and let WCO render only the
    // OS-supplied min/max/close buttons over our title bar. Everything
    // else (project switcher, panel toggle, drag region) lives in the
    // renderer-side TitleBar component.
    frame: false,
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#0e1820",
      symbolColor: "#cbd6df",
      height: 36,
    },
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (rendererUrl) {
    void mainWindow.loadURL(rendererUrl);
    mainWindow.webContents.openDevTools({ mode: "detach" });
    return;
  }

  void mainWindow.loadFile(path.resolve(__dirname, "../../dist/index.html"));
}

void app.whenReady()
  .then(async () => {
    await bootstrapPersistence();
    registerIpcHandlers();
    createMainWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      }
    });
  })
  .catch((error: unknown) => {
    console.error("Failed to start Evernear.", error);
    app.quit();
  });

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
