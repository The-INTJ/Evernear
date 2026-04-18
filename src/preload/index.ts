import { contextBridge, ipcRenderer } from "electron";

import {
  HARNESS_CHANNELS,
  type HarnessBridge,
} from "../shared/contracts/harnessApi";

const bridge: HarnessBridge = {
  async getStatus() {
    return ipcRenderer.invoke(HARNESS_CHANNELS.getStatus);
  },
  async loadDocument() {
    return ipcRenderer.invoke(HARNESS_CHANNELS.loadDocument);
  },
  async saveDocument(input) {
    return ipcRenderer.invoke(HARNESS_CHANNELS.saveDocument, input);
  },
  async seedFixture() {
    return ipcRenderer.invoke(HARNESS_CHANNELS.seedFixture);
  },
  async readClipboardText() {
    return ipcRenderer.invoke(HARNESS_CHANNELS.readClipboardText);
  },
  async readClipboardHtml() {
    return ipcRenderer.invoke(HARNESS_CHANNELS.readClipboardHtml);
  },
  async clearClipboard() {
    await ipcRenderer.invoke(HARNESS_CHANNELS.clearClipboard);
  },
};

contextBridge.exposeInMainWorld("evernear", bridge);
