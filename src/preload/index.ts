import { contextBridge, ipcRenderer } from "electron";

import {
  HARNESS_CHANNELS,
  type HarnessBridge,
} from "../shared/contracts/harnessApi";

const bridge: HarnessBridge = {
  async getStatus() {
    return ipcRenderer.invoke(HARNESS_CHANNELS.getStatus);
  },
  async loadState() {
    return ipcRenderer.invoke(HARNESS_CHANNELS.loadState);
  },
  async replaceDocumentHead(input) {
    return ipcRenderer.invoke(HARNESS_CHANNELS.replaceDocumentHead, input);
  },
  async applyDocumentTransaction(input) {
    return ipcRenderer.invoke(HARNESS_CHANNELS.applyDocumentTransaction, input);
  },
  async writeCheckpoint(label) {
    await ipcRenderer.invoke(HARNESS_CHANNELS.writeCheckpoint, label);
  },
  async createAnchorProbe(input) {
    return ipcRenderer.invoke(HARNESS_CHANNELS.createAnchorProbe, input);
  },
  async deleteAnchorProbe(input) {
    return ipcRenderer.invoke(HARNESS_CHANNELS.deleteAnchorProbe, input);
  },
  async upsertMatchingRule(input) {
    return ipcRenderer.invoke(HARNESS_CHANNELS.upsertMatchingRule, input);
  },
  async deleteMatchingRule(input) {
    return ipcRenderer.invoke(HARNESS_CHANNELS.deleteMatchingRule, input);
  },
  async replayDocumentToVersion(targetVersion) {
    return ipcRenderer.invoke(HARNESS_CHANNELS.replayDocumentToVersion, targetVersion);
  },
  async rebuildProjectionsFromHistory() {
    return ipcRenderer.invoke(HARNESS_CHANNELS.rebuildProjectionsFromHistory);
  },
  async recordBenchmark(category, payload) {
    return ipcRenderer.invoke(HARNESS_CHANNELS.recordBenchmark, category, payload);
  },
  async loadSmallFixture() {
    return ipcRenderer.invoke(HARNESS_CHANNELS.loadSmallFixture);
  },
  async runAnchorScenarios() {
    return ipcRenderer.invoke(HARNESS_CHANNELS.runAnchorScenarios);
  },
  async runMatchingScenarios() {
    return ipcRenderer.invoke(HARNESS_CHANNELS.runMatchingScenarios);
  },
  async runHistoryScenario() {
    return ipcRenderer.invoke(HARNESS_CHANNELS.runHistoryScenario);
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
