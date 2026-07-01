import { createAdaptorServer, serve } from "@hono/node-server";
import type { Server as HttpServer } from "node:http";
import { app } from "./http/app.js";
import {
  attachCollabToHttpServer,
  createCollabServer,
  type CollabServer,
} from "./collab/server.js";
import { serverConfig } from "./shared/config.js";
import { deliverToLocalConnections } from "./ws/connection-pool.js";
import { initNotificationBroadcastRedis } from "./ws/notification-redis.js";
import { initCacheRedis } from "./shared/redis-cache.js";
import { attachNotificationWs } from "./ws/notification-ws.js";

export type BootstrappedHttpServer = {
  httpServer: HttpServer;
  collabServer: CollabServer;
};

async function prepareNotificationBroadcast(): Promise<void> {
  await initNotificationBroadcastRedis(deliverToLocalConnections);
  await initCacheRedis();
}

function attachWebSocketRoutes(
  httpServer: HttpServer,
  collabServer: CollabServer
): void {
  attachCollabToHttpServer(
    httpServer,
    collabServer,
    serverConfig.collabPath
  );
  attachNotificationWs(httpServer, "/ws/notifications");
}

/**
 * Vercel: export the HTTP server without calling listen().
 * @see https://vercel.com/docs/functions/websockets
 */
export async function createVercelHttpServer(): Promise<BootstrappedHttpServer> {
  await prepareNotificationBroadcast();
  const collabServer = await createCollabServer();
  const httpServer = createAdaptorServer({
    fetch: app.fetch,
  }) as HttpServer;

  attachWebSocketRoutes(httpServer, collabServer);

  return { httpServer, collabServer };
}

/** Local / Docker: listen on SERVER_HTTP_PORT (default 4000). */
export async function createListeningHttpServer(
  port: number = serverConfig.httpPort
): Promise<BootstrappedHttpServer> {
  await prepareNotificationBroadcast();
  const collabServer = await createCollabServer();

  const httpServer = serve(
    {
      fetch: app.fetch,
      port,
    },
    () => {
      void collabServer.hocuspocus.hooks("onListen", {
        instance: collabServer.hocuspocus,
        configuration: collabServer.hocuspocus.configuration,
        port,
      });
    }
  ) as HttpServer;

  attachWebSocketRoutes(httpServer, collabServer);

  return { httpServer, collabServer };
}
