import path from "node:path";

import { app, BrowserWindow } from "electron";

import { SqliteHarness } from "../db/sqliteHarness";
import { WorkspaceRepository } from "../db/repositories/WorkspaceRepository";
import { HARNESS_CONTENT_FORMAT, HARNESS_CONTENT_SCHEMA_VERSION } from "../shared/domain/document";
import type { WorkspaceStatus } from "../shared/domain/workspace";
import { setupIpcHandlers } from "./setupIpcHandlers";

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
    setupIpcHandlers(repository, () => workspaceStatus);
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
