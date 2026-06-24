import type { IncomingMessage } from "node:http";
import type { WebSocket } from "ws";
import { WebSocketServer } from "ws";
import type { Server as HttpServer } from "node:http";
import {
  addConnection,
  removeConnection,
  extractUserIdFromToken,
} from "./connection-pool.js";

const HEARTBEAT_INTERVAL = 30_000; // 30s
const HEARTBEAT_TIMEOUT = 60_000;  // 60s

export function attachNotificationWs(
  httpServer: HttpServer,
  path: string = "/ws/notifications"
): void {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (req: IncomingMessage, socket, head) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    if (url.pathname !== path) return;

    const userId = extractUserIdFromToken(req);
    if (!userId) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req, userId);
    });
  });

  wss.on("connection", (ws: WebSocket, _req: IncomingMessage, userId: string) => {
    addConnection(userId, ws);

    // Heartbeat
    let alive = true;
    const heartbeat = setInterval(() => {
      if (!alive) {
        clearInterval(heartbeat);
        ws.terminate();
        return;
      }
      alive = false;
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: "ping" }));
      }
    }, HEARTBEAT_INTERVAL);

    const timeout = setTimeout(() => {
      // No pong within timeout on first tick
    }, HEARTBEAT_TIMEOUT);

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "pong") {
          alive = true;
        }
      } catch {
        // ignore malformed messages
      }
    });

    ws.on("close", () => {
      clearInterval(heartbeat);
      clearTimeout(timeout);
      removeConnection(userId, ws);
    });

    ws.on("error", () => {
      clearInterval(heartbeat);
      clearTimeout(timeout);
      removeConnection(userId, ws);
    });
  });
}
