import react from "@vitejs/plugin-react";
import { defineConfig } from "wxt";

/** Override with env when Chrome is installed elsewhere (e.g. CI). */
const chromeBinary =
  process.env.WXT_CHROME_BINARY ??
  "C:/Users/Administrator/AppData/Local/Google/Chrome/Application/chrome.exe";

// See https://wxt.dev/api/config.html
// @vitejs/plugin-react 6+ targets Vite 8; use 5.x with WXT's Vite 7.
export default defineConfig({
  vite: () => ({
    plugins: [react()],
  }),
  manifest: {
    name: "知作",
    action: {
      default_title: "打开 AI 侧边栏",
    },
  },
  webExt: {
    binaries: {
      chrome: chromeBinary,
    },
  },
});
