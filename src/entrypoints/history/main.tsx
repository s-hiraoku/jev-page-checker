import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { liveBridge } from "../../lib/bridge.js";
import { HistoryApp } from "../../ui/HistoryApp.js";
import "../../ui/theme.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HistoryApp bridge={liveBridge()} />
  </StrictMode>,
);
