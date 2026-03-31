import "./globals.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SidePanelApp } from "./SidePanelApp";

const root = document.querySelector("#app");
if (!root) {
  throw new Error("Root element #app not found");
}

createRoot(root).render(
  <StrictMode>
    <SidePanelApp />
  </StrictMode>,
);
