import React from "react";
import ReactDOM from "react-dom/client";

import { App } from "./App";
import { installDevBrowserBridge } from "./utils/devBrowserBridge";
import "./styles.css";

installDevBrowserBridge();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

