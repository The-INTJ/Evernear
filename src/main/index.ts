import path from "node:path";
import { randomUUID } from "node:crypto";

import { app, BrowserWindow } from "electron";

import { SqliteHarness } from "../db/sqliteHarness";
import { WorkspaceRepository } from "../db/repositories/WorkspaceRepository";
import { HARNESS_CONTENT_FORMAT, HARNESS_CONTENT_SCHEMA_VERSION } from "../shared/domain/document";
import type { WorkspaceStatus } from "../shared/domain/workspace";
import { setupIpcHandlers } from "./setupIpcHandlers";

const rendererUrl = process.env.EVERNEAR_RENDERER_URL;

let mainWindow: BrowserWindow | null = null;
const paneWindows = new Map<string, BrowserWindow>();
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

function loadRenderer(window: BrowserWindow, paneId?: string): void {
  if (rendererUrl) {
    const url = paneId
      ? `${rendererUrl}?paneId=${encodeURIComponent(paneId)}`
      : rendererUrl;
    void window.loadURL(url);
    window.webContents.openDevTools({ mode: "detach" });
    return;
  }

  void window.loadFile(path.resolve(__dirname, "../../dist/index.html"), paneId ? {
    query: { paneId },
  } : undefined);
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

  loadRenderer(mainWindow);
}

function createPaneWindow(paneId: string): void {
  const windowId = randomUUID();
  const paneWindow = new BrowserWindow({
    width: 980,
    height: 760,
    minWidth: 520,
    minHeight: 420,
    backgroundColor: "#0e1820",
    title: "Evernear Pane",
    frame: true,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  paneWindows.set(windowId, paneWindow);
  repository.movePane({
    paneId,
    placement: {
      kind: "nativeWindow",
      windowId,
      rect: { x: 80, y: 80, width: 980, height: 760 },
    },
  });

  paneWindow.on("closed", () => {
    paneWindows.delete(windowId);
    try {
      repository.movePane({
        paneId,
        placement: {
          kind: "workspace",
          rect: { x: 360, y: 140, width: 720, height: 620 },
          zIndex: 20,
        },
      });
    } catch (error) {
      console.warn("Failed to restore pane after native window close.", error);
    }
  });

  loadRenderer(paneWindow, paneId);
}

void app.whenReady()
  .then(async () => {
    await bootstrapPersistence();
    setupIpcHandlers(repository, () => workspaceStatus, (paneId) => {
      createPaneWindow(paneId);
      return repository.loadWorkspace();
    });
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
