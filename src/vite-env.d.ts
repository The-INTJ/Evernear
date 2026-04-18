/// <reference types="vite/client" />

import type { HarnessBridge } from "./shared/contracts/harnessApi";

declare global {
  interface Window {
    evernear: HarnessBridge;
  }
}

export {};
