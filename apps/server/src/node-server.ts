import { createListeningHttpServer } from "./bootstrap-http-server.js";
import { serverConfig } from "./shared/config.js";
import { closeNotificationBroadcastRedis } from "./ws/notification-redis.js";
import { closeCacheRedis, initCacheRedis } from "./shared/redis-cache.js";
import { deliverToLocalConnections } from "./ws/connection-pool.js";
import { initNotificationBroadcastRedis } from "./ws/notification-redis.js";
import { startJobWorkers, stopJobWorkers } from "./jobs/workers.js";

console.log("[Server] Starting HTTP API and Collab services...");

await initNotificationBroadcastRedis(deliverToLocalConnections);
await initCacheRedis();
await startJobWorkers();

const { httpServer, collabServer } = await createListeningHttpServer(
  serverConfig.httpPort
);

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
  await stopJobWorkers();
  await closeNotificationBroadcastRedis();
  await closeCacheRedis();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
