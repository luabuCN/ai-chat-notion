/** Geist 随扩展打包（Fontsource），侧栏打开即用，与登录无关。登录后主站 content script 同步会话，React 会重绘头像等，无需再「拉字体」。 */
import "@fontsource-variable/geist/wght.css";
import "@fontsource-variable/geist-mono/wght.css";
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
