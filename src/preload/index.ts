import { contextBridge, ipcRenderer } from "electron";

import {
  HARNESS_CHANNELS,
  type HarnessBridge,
} from "../shared/contracts/harnessApi";

const bridge: HarnessBridge = {
  async getStatus() {
    return ipcRenderer.invoke(HARNESS_CHANNELS.getStatus);
  },
  async loadWorkspace() {
    return ipcRenderer.invoke(HARNESS_CHANNELS.loadWorkspace);
  },
  async createProject(input) {
    return ipcRenderer.invoke(HARNESS_CHANNELS.createProject, input);
  },
  async updateProject(input) {
    return ipcRenderer.invoke(HARNESS_CHANNELS.updateProject, input);
  },
  async openProject(input) {
    return ipcRenderer.invoke(HARNESS_CHANNELS.openProject, input);
  },
  async createFolder(input) {
    return ipcRenderer.invoke(HARNESS_CHANNELS.createFolder, input);
  },
  async updateFolder(input) {
    return ipcRenderer.invoke(HARNESS_CHANNELS.updateFolder, input);
  },
  async deleteFolder(input) {
    return ipcRenderer.invoke(HARNESS_CHANNELS.deleteFolder, input);
  },
  async createDocument(input) {
    return ipcRenderer.invoke(HARNESS_CHANNELS.createDocument, input);
  },
  async updateDocumentMeta(input) {
    return ipcRenderer.invoke(HARNESS_CHANNELS.updateDocumentMeta, input);
  },
  async deleteDocument(input) {
    return ipcRenderer.invoke(HARNESS_CHANNELS.deleteDocument, input);
  },
  async reorderDocument(input) {
    return ipcRenderer.invoke(HARNESS_CHANNELS.reorderDocument, input);
  },
  async openDocument(input) {
    return ipcRenderer.invoke(HARNESS_CHANNELS.openDocument, input);
  },
  async updateLayout(input) {
    return ipcRenderer.invoke(HARNESS_CHANNELS.updateLayout, input);
  },
  async createPane(input) {
    return ipcRenderer.invoke(HARNESS_CHANNELS.createPane, input);
  },
  async updatePane(input) {
    return ipcRenderer.invoke(HARNESS_CHANNELS.updatePane, input);
  },
  async closePane(input) {
    return ipcRenderer.invoke(HARNESS_CHANNELS.closePane, input);
  },
  async focusPane(input) {
    return ipcRenderer.invoke(HARNESS_CHANNELS.focusPane, input);
  },
  async replacePaneContent(input) {
    return ipcRenderer.invoke(HARNESS_CHANNELS.replacePaneContent, input);
  },
  async pushPaneContent(input) {
    return ipcRenderer.invoke(HARNESS_CHANNELS.pushPaneContent, input);
  },
  async popPaneContent(input) {
    return ipcRenderer.invoke(HARNESS_CHANNELS.popPaneContent, input);
  },
  async movePane(input) {
    return ipcRenderer.invoke(HARNESS_CHANNELS.movePane, input);
  },
  async popOutPane(input) {
    return ipcRenderer.invoke(HARNESS_CHANNELS.popOutPane, input);
  },
  async applyDocumentTransaction(input) {
    return ipcRenderer.invoke(HARNESS_CHANNELS.applyDocumentTransaction, input);
  },
  async createEntity(input) {
    return ipcRenderer.invoke(HARNESS_CHANNELS.createEntity, input);
  },
  async updateEntity(input) {
    return ipcRenderer.invoke(HARNESS_CHANNELS.updateEntity, input);
  },
  async deleteEntity(input) {
    return ipcRenderer.invoke(HARNESS_CHANNELS.deleteEntity, input);
  },
  async upsertMatchingRule(input) {
    return ipcRenderer.invoke(HARNESS_CHANNELS.upsertMatchingRule, input);
  },
  async deleteMatchingRule(input) {
    return ipcRenderer.invoke(HARNESS_CHANNELS.deleteMatchingRule, input);
  },
  async createSlice(input) {
    return ipcRenderer.invoke(HARNESS_CHANNELS.createSlice, input);
  },
  async deleteSlice(input) {
    return ipcRenderer.invoke(HARNESS_CHANNELS.deleteSlice, input);
  },
  async updateSliceBoundary(input) {
    return ipcRenderer.invoke(HARNESS_CHANNELS.updateSliceBoundary, input);
  },
  async writeCheckpoint(documentId, label) {
    await ipcRenderer.invoke(HARNESS_CHANNELS.writeCheckpoint, documentId, label);
  },
  async replayDocumentToVersion(documentId, targetVersion) {
    return ipcRenderer.invoke(HARNESS_CHANNELS.replayDocumentToVersion, documentId, targetVersion);
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
