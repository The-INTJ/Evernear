import React from "react";
import ReactDOM from "react-dom/client";

import { App } from "./App";
import { ErrorBoundary } from "./features/chrome/ErrorBoundary";
import { installDevBrowserBridge } from "./utils/devBrowserBridge";
import "./styles/index.css";

installDevBrowserBridge();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
