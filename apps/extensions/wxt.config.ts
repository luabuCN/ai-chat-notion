import react from "@vitejs/plugin-react";
import { defineConfig } from "wxt";

// 与 apps/web 一致；用于 host_permissions、import.meta.env.WXT_WEB_ORIGIN
const webOrigin = process.env.WXT_WEB_ORIGIN ?? "http://localhost:3000";

const chromeBinary =
  process.env.WXT_CHROME_BINARY ??
  "C:/Users/Administrator/AppData/Local/Google/Chrome/Application/chrome.exe";

function webOriginToHostPermission(origin: string): string {
  try {
    return `${new URL(origin).origin}/*`;
  } catch {
    return "http://localhost:3000/*";
  }
}

/** 与 host_permissions 同源，供主站 content script `matches` 使用 */
function webOriginToContentMatchPattern(origin: string): string {
  try {
    return `${new URL(origin).origin}/*`;
  } catch {
    return "http://localhost:3000/*";
  }
}

export default defineConfig({
  dev: {
    server: {
      port: 8088,
      origin: "http://localhost:8088",
    },
  },
  vite: () => ({
    plugins: [react()],
    define: {
      "import.meta.env.WXT_WEB_ORIGIN": JSON.stringify(webOrigin),
      "import.meta.env.WXT_WEB_MATCH_PATTERN": JSON.stringify(
        webOriginToContentMatchPattern(webOrigin),
      ),
    },
  }),
  manifest: {
    name: "知作",
    action: {
      default_title: "打开 AI 侧边栏",
    },
    permissions: ["cookies", "sidePanel", "storage", "tabs"],
    host_permissions: [webOriginToHostPermission(webOrigin)],
  },
  webExt: {
    binaries: {
      chrome: chromeBinary,
    },
  },
});
