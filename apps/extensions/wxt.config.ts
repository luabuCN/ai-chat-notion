import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "wxt";

/** 扩展根目录（wxt.config.ts 所在目录），用于固定 React 单实例，避免与 @repo/ui 重复打包导致 useState 报错 */
const extensionRoot = path.dirname(fileURLToPath(import.meta.url));

// 主站（登录、extension/api-token、auth-status）；与 apps/web 一致
const webOrigin =
  process.env.WXT_WEB_ORIGIN ?? process.env.WEB_URL ?? "http://localhost:3000";
// 业务 API 直连 server（除 extension/* 外）；可与仓库根 API_URL 对齐
const apiOrigin =
  process.env.WXT_API_ORIGIN ?? process.env.API_URL ?? "http://localhost:4000";

function resolveChromeBinary(): string {
  if (process.env.WXT_CHROME_BINARY) {
    return process.env.WXT_CHROME_BINARY;
  }

  const localAppData = process.env.LOCALAPPDATA;
  const candidates = [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    localAppData
      ? path.join(localAppData, "Google/Chrome/Application/chrome.exe")
      : null,
  ].filter((p): p is string => p !== null);

  const found = candidates.find((p) => existsSync(p));
  return found ?? candidates[0];
}

const chromeBinary = resolveChromeBinary();

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
      "import.meta.env.WXT_API_ORIGIN": JSON.stringify(apiOrigin),
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
    permissions: [
      "activeTab",
      "cookies",
      "scripting",
      "sidePanel",
      "storage",
      "tabs",
    ],
    /**
     * 含全网 http(s)：供 background 拉取页面跨域图片（不受页面 fetch CORS 限制）。
     */
    host_permissions: [
      webOriginToHostPermission(webOrigin),
      webOriginToHostPermission(apiOrigin),
      "http://*/*",
      "https://*/*",
    ],
  },
  webExt: {
    binaries: {
      chrome: chromeBinary,
    },
  },
});
