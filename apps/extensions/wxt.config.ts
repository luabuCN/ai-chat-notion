import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "wxt";

/** 扩展根目录（wxt.config.ts 所在目录），用于固定 React 单实例，避免与 @repo/ui 重复打包导致 useState 报错 */
const extensionRoot = path.dirname(fileURLToPath(import.meta.url));

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
    resolve: {
      dedupe: ["react", "react-dom"],
      alias: {
        react: path.resolve(extensionRoot, "node_modules/react"),
        "react-dom": path.resolve(extensionRoot, "node_modules/react-dom"),
        "react/jsx-runtime": path.resolve(
          extensionRoot,
          "node_modules/react/jsx-runtime.js",
        ),
        "react/jsx-dev-runtime": path.resolve(
          extensionRoot,
          "node_modules/react/jsx-dev-runtime.js",
        ),
      },
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
