import { Hocuspocus, type Extension } from "@hocuspocus/server";
import type { Server as HttpServer, IncomingMessage } from "node:http";
import type WebSocket from "ws";
import { WebSocketServer } from "ws";
import { Logger } from "@hocuspocus/extension-logger";
import { databaseExtension } from "./extensions/database.js";
import { getSafeRedisExtension } from "./extensions/redis.js";
import {
  verifyToken,
  verifyDocumentAccess,
  getCachedAccess,
  setCachedAccess,
} from "./auth.js";

export type CollabServer = {
  hocuspocus: Hocuspocus;
  webSocketServer: WebSocketServer;
  destroy: () => Promise<void>;
};

export async function createCollabServer(): Promise<CollabServer> {
  const extensions: Extension[] = [
    new Logger({
      log: (message) => {
        console.log(`[Hocuspocus] ${message}`);
      },
      onLoadDocument: true,
      onChange: false,
      onConnect: true,
      onDisconnect: true,
      onUpgrade: false,
      onRequest: false,
      onDestroy: true,
      onConfigure: true,
    }),
    databaseExtension,
  ];

  const redisExtension = await getSafeRedisExtension();
  if (redisExtension) {
    extensions.push(redisExtension);
    console.log("✅ Redis extension enabled for multi-instance sync");
  } else {
    console.log("⚠️  Redis extension disabled (Single-instance mode)");
  }

  const hocuspocus = new Hocuspocus({
    timeout: 30000,
    debounce: 2000,
    maxDebounce: 10000,
    extensions,

    async onAuthenticate({ token, documentName, connectionConfig }) {
      console.log(`[Auth] Authenticating for document: ${documentName}`);

      const payload = await verifyToken(token);
      if (!payload) {
        throw new Error("Invalid or expired token");
      }

      const { access, document } = await verifyDocumentAccess(
        documentName,
        payload.userId,
        payload.email
      );

      // 写入权限缓存，供 onChange/store 复用
      setCachedAccess(documentName, payload.userId, payload.email, access);

      if (access === "none") {
        throw new Error("You don't have access to this document");
      }

      if (access === "view") {
        connectionConfig.readOnly = true;
      }

      return {
        user: {
          id: payload.userId,
          name: payload.name || payload.email?.split("@")[0] || "Anonymous",
          email: payload.email,
        },
        accessLevel: access,
        document,
      };
    },

    async onConnect({ documentName, context }) {
      const userName = context?.user?.name || context?.user?.id || "Unknown";
      console.log(
        `[Connect] User ${userName} (${
          context?.user?.email || "no email"
        }) connected to document ${documentName}`
      );
    },

    async onDisconnect({ documentName, context }) {
      console.log(
        `[Disconnect] User ${context?.user?.name} disconnected from document ${documentName}`
      );
    },

    async onLoadDocument({ documentName, document }) {
      try {
        const fragment = document.getXmlFragment("default");
        console.log(
          `[Load] Document ${documentName} loaded with ${fragment.length} items`
        );
      } catch {
        console.log(
          `[Load] Document ${documentName} loaded (unable to count items)`
        );
      }
    },

    async onChange({ documentName, context, transactionOrigin }) {
      const user = context?.user;
      if (!user?.id) {
        return;
      }

      // 先查缓存，命中则跳过 DB 查询
      const cached = getCachedAccess(documentName, user.id, user.email);
      if (cached !== null) {
        if (cached !== "owner" && cached !== "edit") {
          try {
            if (
              transactionOrigin &&
              typeof transactionOrigin === "object" &&
              transactionOrigin.webSocket &&
              typeof transactionOrigin.webSocket.close === "function"
            ) {
              transactionOrigin.webSocket.close(4003, "permission_changed");
            }
          } catch (closeError) {
            console.error(
              `[Auth] Error closing connection for ${documentName}:`,
              closeError
            );
          }
        }
        return;
      }

      // 缓存未命中，查询 DB
      try {
        const { access } = await verifyDocumentAccess(
          documentName,
          user.id,
          user.email
        );
        setCachedAccess(documentName, user.id, user.email, access);

        if (access !== "owner" && access !== "edit") {
          console.warn(
            `[Auth] Permission revoked for user ${user.id} on document ${documentName} (now: ${access}), closing connection`
          );
          try {
            if (
              transactionOrigin &&
              typeof transactionOrigin === "object" &&
              transactionOrigin.webSocket &&
              typeof transactionOrigin.webSocket.close === "function"
            ) {
              transactionOrigin.webSocket.close(4003, "permission_changed");
            }
          } catch (closeError) {
            console.error(
              `[Auth] Error closing connection for ${documentName}:`,
              closeError
            );
          }
        }
      } catch (error) {
        console.error(
          `[Auth] Error verifying permission for ${documentName}:`,
          error
        );
      }
    },

    async onStoreDocument({ documentName }) {
      console.log(`[Store] Document ${documentName} stored successfully`);
    },
  });

  const webSocketServer = new WebSocketServer({ noServer: true });

  webSocketServer.on(
    "connection",
    (incoming: WebSocket, request: IncomingMessage) => {
      incoming.setMaxListeners(Number.POSITIVE_INFINITY);

      incoming.on("error", (error) => {
        console.error("Error emitted from webSocket instance:");
        console.error(error);
      });

      hocuspocus.handleConnection(incoming, request);
    }
  );

  return {
    hocuspocus,
    webSocketServer,
    destroy: async () => {
      webSocketServer.close();
      hocuspocus.closeConnections();
      await hocuspocus.hooks("onDestroy", { instance: hocuspocus });
    },
  };
}

export function attachCollabToHttpServer(
  httpServer: HttpServer,
  collabServer: CollabServer,
  path: string
) {
  const normalizedPath =
    path.startsWith("/") ? path.replace(/\/$/, "") || "/" : `/${path}`;

  httpServer.on("upgrade", async (request, socket, head) => {
    const pathname = new URL(
      request.url || "/",
      `http://${request.headers.host || "localhost"}`
    ).pathname.replace(/\/$/, "") || "/";

    if (pathname !== normalizedPath) {
      return;
    }

    try {
      await collabServer.hocuspocus.hooks("onUpgrade", {
        request,
        socket,
        head,
        instance: collabServer.hocuspocus,
      });

      collabServer.webSocketServer.handleUpgrade(request, socket, head, (ws) => {
        collabServer.webSocketServer.emit("connection", ws, request);
      });
    } catch (error) {
      socket.destroy();
      if (error) {
        console.error("[Collab] WebSocket upgrade failed:", error);
      }
    }
  });
}
