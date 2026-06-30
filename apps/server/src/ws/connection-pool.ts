import type { IncomingMessage } from "node:http";
import type { WebSocket } from "ws";
import jwt from "jsonwebtoken";
import type { ApiTokenPayload } from "../shared/auth.js";
import {
  isNotificationRedisEnabled,
  publishNotificationBroadcast,
} from "./notification-redis.js";

// Global singleton connection pool: userId -> Set<WebSocket>
const pool = new Map<string, Set<WebSocket>>();

export function addConnection(userId: string, ws: WebSocket): void {
  let conns = pool.get(userId);
  if (!conns) {
    conns = new Set();
    pool.set(userId, conns);
  }
  conns.add(ws);
}

export function removeConnection(userId: string, ws: WebSocket): void {
  const conns = pool.get(userId);
  if (!conns) return;
  conns.delete(ws);
  if (conns.size === 0) {
    pool.delete(userId);
  }
}

export function getConnections(userId: string): Set<WebSocket> {
  return pool.get(userId) ?? new Set();
}

export function deliverToLocalConnections(userId: string, data: object): void {
  const conns = getConnections(userId);
  const message = JSON.stringify(data);
  for (const ws of conns) {
    if (ws.readyState === ws.OPEN) {
      ws.send(message);
    }
  }
}

export function broadcast(userId: string, data: object): void {
  if (isNotificationRedisEnabled()) {
    publishNotificationBroadcast(userId, data);
    return;
  }

  deliverToLocalConnections(userId, data);
}

/**
 * Extract userId from JWT token in the URL query string.
 * Uses AUTH_SECRET (same as collab token generation).
 */
export function extractUserIdFromToken(req: IncomingMessage): string | null {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const token = url.searchParams.get("token");
    if (!token) return null;

    const secret = process.env.AUTH_SECRET;
    if (!secret) return null;

    const payload = jwt.verify(token, secret) as ApiTokenPayload;
    return payload.userId ?? null;
  } catch {
    return null;
  }
}
