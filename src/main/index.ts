import path from "node:path";

import { app, BrowserWindow, clipboard, ipcMain } from "electron";

import { WorkbenchRepository } from "../db/workbenchRepository";
import { SqliteHarness } from "../db/sqliteHarness";
import {
  HARNESS_CONTENT_FORMAT,
  HARNESS_CONTENT_SCHEMA_VERSION,
  HARNESS_DOCUMENT_ID,
} from "../shared/domain/document";
import {
  HARNESS_CHANNELS,
} from "../shared/contracts/harnessApi";
import type { WorkbenchStatus } from "../shared/domain/workbench";

const rendererUrl = process.env.EVERNEAR_RENDERER_URL;

let mainWindow: BrowserWindow | null = null;
let repository: WorkbenchRepository;
let harnessStatus: WorkbenchStatus;

async function bootstrapPersistence(): Promise<void> {
  const runtimeRoot = process.cwd();
  const dbPath = path.join(runtimeRoot, ".local", "phase-1-harness.sqlite");
  const sqliteHarness = SqliteHarness.open(dbPath, "FULL");

  repository = new WorkbenchRepository(sqliteHarness);
  repository.ensureWorkbenchState();

  harnessStatus = {
    dbPath,
    documentId: HARNESS_DOCUMENT_ID,
    contentFormat: HARNESS_CONTENT_FORMAT,
    contentSchemaVersion: HARNESS_CONTENT_SCHEMA_VERSION,
    synchronousMode: sqliteHarness.synchronousMode,
    storageEngine: "better-sqlite3",
  };
}

function registerIpcHandlers(): void {
  ipcMain.handle(HARNESS_CHANNELS.getStatus, () => harnessStatus);
  ipcMain.handle(HARNESS_CHANNELS.loadState, () => repository.loadWorkbenchState());
  ipcMain.handle(HARNESS_CHANNELS.replaceDocumentHead, (_event, input) => repository.replaceDocumentHead(input));
  ipcMain.handle(HARNESS_CHANNELS.applyDocumentTransaction, (_event, input) => repository.applyDocumentTransaction(input));
  ipcMain.handle(HARNESS_CHANNELS.writeCheckpoint, (_event, label) => {
    repository.writeCheckpoint(label);
  });
  ipcMain.handle(HARNESS_CHANNELS.createAnchorProbe, (_event, input) => repository.createAnchorProbe(input));
  ipcMain.handle(HARNESS_CHANNELS.deleteAnchorProbe, (_event, input) => repository.deleteAnchorProbe(input));
  ipcMain.handle(HARNESS_CHANNELS.upsertMatchingRule, (_event, input) => repository.upsertMatchingRule(input));
  ipcMain.handle(HARNESS_CHANNELS.deleteMatchingRule, (_event, input) => repository.deleteMatchingRule(input));
  ipcMain.handle(HARNESS_CHANNELS.replayDocumentToVersion, (_event, targetVersion) => repository.replayDocumentToVersion(targetVersion));
  ipcMain.handle(HARNESS_CHANNELS.rebuildProjectionsFromHistory, () => repository.rebuildProjectionsFromHistory());
  ipcMain.handle(HARNESS_CHANNELS.recordBenchmark, (_event, category, payload) => repository.recordBenchmark(category, payload));
  ipcMain.handle(HARNESS_CHANNELS.loadSmallFixture, () => repository.loadSmallFixture());
  ipcMain.handle(HARNESS_CHANNELS.runAnchorScenarios, () => repository.runAnchorScenarios());
  ipcMain.handle(HARNESS_CHANNELS.runMatchingScenarios, () => repository.runMatchingScenarios());
  ipcMain.handle(HARNESS_CHANNELS.runHistoryScenario, () => repository.runHistoryScenario());
  ipcMain.handle(HARNESS_CHANNELS.readClipboardText, () => clipboard.readText());
  ipcMain.handle(HARNESS_CHANNELS.readClipboardHtml, () => clipboard.readHTML());
  ipcMain.handle(HARNESS_CHANNELS.clearClipboard, () => {
    clipboard.clear();
  });
}

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 980,
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: "#0e1820",
    title: "Evernear Phase 1 Harness",
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
    console.error("Failed to start Evernear Phase 1 Harness.", error);
    app.quit();
  });

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
