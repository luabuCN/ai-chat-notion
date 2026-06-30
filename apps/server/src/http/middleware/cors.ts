import { cors } from "hono/cors";
import { serverConfig } from "../../shared/config.js";

function configuredOrigins() {
  return new Set(
    [
      serverConfig.webOrigin,
      serverConfig.apiOrigin,
      process.env.CHROME_EXTENSION_ORIGIN,
      process.env.FIREFOX_EXTENSION_ORIGIN,
      process.env.WXT_WEB_ORIGIN,
      process.env.WXT_API_ORIGIN,
    ].filter((origin): origin is string => Boolean(origin))
  );
}

export const serverCors = cors({
  origin: (origin) => {
    if (!origin) {
      return null;
    }

    if (configuredOrigins().has(origin)) {
      return origin;
    }

    // 本地前端 + 远程后端：允许 localhost 跨域（WebSocket 等直连场景）
    if (
      origin.startsWith("http://localhost:") ||
      origin.startsWith("http://127.0.0.1:")
    ) {
      return origin;
    }

    if (!serverConfig.isProduction) {
      if (origin.startsWith("chrome-extension://")) {
        return origin;
      }
      if (origin.startsWith("moz-extension://")) {
        return origin;
      }
    }

    return null;
  },
  credentials: true,
  allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowHeaders: [
    "Content-Type",
    "Authorization",
    "Cookie",
    "User-Agent",
    "X-Requested-With",
  ],
  maxAge: 86400,
});
