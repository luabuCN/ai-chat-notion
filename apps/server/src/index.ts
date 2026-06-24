import { serve } from "@hono/node-server";
import type { Server as HttpServer } from "node:http";
import { app } from "./http/app.js";
import {
  attachCollabToHttpServer,
  createCollabServer,
} from "./collab/server.js";
import { serverConfig } from "./shared/config.js";
import { attachNotificationWs } from "./ws/notification-ws.js";

console.log("[Server] Starting HTTP API and Collab services...");

const collabServer = await createCollabServer();

const httpServer = serve(
  {
    fetch: app.fetch,
    port: serverConfig.httpPort,
  },
  (info) => {
    void collabServer.hocuspocus.hooks("onListen", {
      instance: collabServer.hocuspocus,
      configuration: collabServer.hocuspocus.configuration,
      port: info.port,
    });
  }
);

attachCollabToHttpServer(
  httpServer as HttpServer,
  collabServer,
  serverConfig.collabPath
);

attachNotificationWs(httpServer as HttpServer, "/ws/notifications");

const collabUrl = `${serverConfig.apiOrigin.replace(/^http/, "ws")}${serverConfig.collabPath}`;

console.log(
  `[Server] HTTP API running on http://localhost:${serverConfig.httpPort}`
);
console.log(`[Server] Collab WebSocket running on ${collabUrl}`);
console.log(
  `[Server] Notification WebSocket running on ws://localhost:${serverConfig.httpPort}/ws/notifications`
);

async function shutdown() {
  console.log("\n[Server] Shutting down gracefully...");
  httpServer.close();
  await collabServer.destroy();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
