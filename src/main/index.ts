import path from "node:path";

import { app, BrowserWindow, clipboard, ipcMain } from "electron";

import { HarnessDocumentRepository } from "../db/documentRepository";
import { SqliteHarness } from "../db/sqliteHarness";
import {
  HARNESS_CONTENT_FORMAT,
  HARNESS_CONTENT_SCHEMA_VERSION,
  HARNESS_DOCUMENT_ID,
} from "../shared/domain/document";
import {
  HARNESS_CHANNELS,
  type HarnessStatus,
} from "../shared/contracts/harnessApi";

const rendererUrl = process.env.EVERNEAR_RENDERER_URL;

let mainWindow: BrowserWindow | null = null;
let repository: HarnessDocumentRepository;
let harnessStatus: HarnessStatus;

async function bootstrapPersistence(): Promise<void> {
  const runtimeRoot = process.cwd();
  const dbPath = path.join(runtimeRoot, ".local", "phase-1-harness.sqlite");
  const sqliteHarness = await SqliteHarness.open(dbPath);

  repository = new HarnessDocumentRepository(sqliteHarness);
  repository.ensureHarnessDocument();

  harnessStatus = {
    dbPath,
    documentId: HARNESS_DOCUMENT_ID,
    contentFormat: HARNESS_CONTENT_FORMAT,
    contentSchemaVersion: HARNESS_CONTENT_SCHEMA_VERSION,
  };
}

function registerIpcHandlers(): void {
  ipcMain.handle(HARNESS_CHANNELS.getStatus, () => harnessStatus);
  ipcMain.handle(HARNESS_CHANNELS.loadDocument, () => repository.loadHarnessDocument());
  ipcMain.handle(HARNESS_CHANNELS.saveDocument, (_event, input) =>
    repository.saveHarnessDocument(input),
  );
  ipcMain.handle(HARNESS_CHANNELS.seedFixture, () => repository.seedFixtureDocument());
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
      sandbox: false,
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
