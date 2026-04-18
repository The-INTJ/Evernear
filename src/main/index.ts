import path from "node:path";

import { app, BrowserWindow, clipboard, ipcMain } from "electron";

import { WorkspaceRepository } from "../db/workbenchRepository";
import { SqliteHarness } from "../db/sqliteHarness";
import { HARNESS_CONTENT_FORMAT, HARNESS_CONTENT_SCHEMA_VERSION } from "../shared/domain/document";
import { HARNESS_CHANNELS } from "../shared/contracts/harnessApi";
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

function registerIpcHandlers(): void {
  ipcMain.handle(HARNESS_CHANNELS.getStatus, () => workspaceStatus);
  ipcMain.handle(HARNESS_CHANNELS.loadWorkspace, () => repository.loadWorkspace());
  ipcMain.handle(HARNESS_CHANNELS.createProject, (_event, input) => repository.createProject(input));
  ipcMain.handle(HARNESS_CHANNELS.updateProject, (_event, input) => repository.updateProject(input));
  ipcMain.handle(HARNESS_CHANNELS.openProject, (_event, input) => repository.openProject(input));
  ipcMain.handle(HARNESS_CHANNELS.createFolder, (_event, input) => repository.createFolder(input));
  ipcMain.handle(HARNESS_CHANNELS.updateFolder, (_event, input) => repository.updateFolder(input));
  ipcMain.handle(HARNESS_CHANNELS.deleteFolder, (_event, input) => repository.deleteFolder(input));
  ipcMain.handle(HARNESS_CHANNELS.createDocument, (_event, input) => repository.createDocument(input));
  ipcMain.handle(HARNESS_CHANNELS.updateDocumentMeta, (_event, input) => repository.updateDocumentMeta(input));
  ipcMain.handle(HARNESS_CHANNELS.deleteDocument, (_event, input) => repository.deleteDocument(input));
  ipcMain.handle(HARNESS_CHANNELS.reorderDocument, (_event, input) => repository.reorderDocument(input));
  ipcMain.handle(HARNESS_CHANNELS.openDocument, (_event, input) => repository.openDocument(input));
  ipcMain.handle(HARNESS_CHANNELS.updateLayout, (_event, input) => repository.updateLayout(input));
  ipcMain.handle(HARNESS_CHANNELS.applyDocumentTransaction, (_event, input) => repository.applyDocumentTransaction(input));
  ipcMain.handle(HARNESS_CHANNELS.createEntity, (_event, input) => repository.createEntity(input));
  ipcMain.handle(HARNESS_CHANNELS.updateEntity, (_event, input) => repository.updateEntity(input));
  ipcMain.handle(HARNESS_CHANNELS.deleteEntity, (_event, input) => repository.deleteEntity(input));
  ipcMain.handle(HARNESS_CHANNELS.upsertMatchingRule, (_event, input) => repository.upsertMatchingRule(input));
  ipcMain.handle(HARNESS_CHANNELS.deleteMatchingRule, (_event, input) => repository.deleteMatchingRule(input));
  ipcMain.handle(HARNESS_CHANNELS.createSlice, (_event, input) => repository.createSlice(input));
  ipcMain.handle(HARNESS_CHANNELS.deleteSlice, (_event, input) => repository.deleteSlice(input));
  ipcMain.handle(HARNESS_CHANNELS.writeCheckpoint, (_event, documentId, label) => {
    repository.writeCheckpoint(documentId, label);
  });
  ipcMain.handle(HARNESS_CHANNELS.replayDocumentToVersion, (_event, documentId, targetVersion) =>
    repository.replayDocumentToVersion(documentId, targetVersion));
  ipcMain.handle(HARNESS_CHANNELS.readClipboardText, () => clipboard.readText());
  ipcMain.handle(HARNESS_CHANNELS.readClipboardHtml, () => clipboard.readHTML());
  ipcMain.handle(HARNESS_CHANNELS.clearClipboard, () => {
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
