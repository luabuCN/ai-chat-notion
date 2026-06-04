# Notification Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real-time notification center for workspace invites, document shares, permission changes, and permission removals.

**Architecture:** Notifications are stored in PostgreSQL via Prisma, created as side-effects in existing business handlers, and pushed to clients via a Hono-native WebSocket with a global connection pool. The frontend uses React Query for data fetching and a custom WebSocket hook for real-time updates, displayed in a Popover from the sidebar.

**Tech Stack:** Next.js 15, Hono, Prisma, PostgreSQL, React Query, Shadcn UI, native WebSocket

---

## File Structure

### New Files

| File | Responsibility |
|---|---|
| `packages/database/prisma/schema.prisma` | (modify) Add `NotificationType` enum and `Notification` model |
| `packages/database/src/queries/notification.ts` | Notification CRUD query functions |
| `packages/database/src/queries.ts` | (modify) Re-export notification queries |
| `apps/server/src/http/routes/notification/index.ts` | REST route definitions |
| `apps/server/src/http/routes/notification/handlers.ts` | REST handler functions |
| `apps/server/src/http/app.ts` | (modify) Register `/api/notifications` route |
| `apps/server/src/ws/connection-pool.ts` | WebSocket connection pool (global Map<userId, Set<WebSocket>>) |
| `apps/server/src/ws/notification-ws.ts` | WebSocket route handler for `/ws/notifications` |
| `apps/server/src/index.ts` | (modify) Mount notification WebSocket on HTTP server |
| `apps/web/lib/api-client.ts` | (modify) Add `/api/notifications` to SERVER_API_PREFIXES |
| `apps/web/hooks/use-notifications.ts` | React Query hooks for notification CRUD |
| `apps/web/hooks/use-notification-ws.ts` | WebSocket connection hook with auto-reconnect |
| `apps/web/components/notification/notification-badge.tsx` | Unread count badge component |
| `apps/web/components/notification/notification-item.tsx` | Single notification row component |
| `apps/web/components/notification/notification-list.tsx` | Notification list with tabs |
| `apps/web/components/notification/notification-center.tsx` | Popover container |
| `apps/web/components/app-sidebar.tsx` | (modify) Add notification entry with badge |
| `apps/web/app/(workbench)/layout.tsx` | (modify) Add NotificationProvider |
| `apps/server/src/http/routes/workspaces/handlers.ts` | (modify) Insert notification triggers |
| `apps/server/src/http/routes/editor-documents/handlers.ts` | (modify) Insert notification triggers |

---

### Task 1: Prisma Schema — Notification Model

**Files:**
- Modify: `packages/database/prisma/schema.prisma`

- [ ] **Step 1: Add NotificationType enum and Notification model to schema**

Add the following at the end of `packages/database/prisma/schema.prisma`, before the closing of the file (after the last model):

```prisma
enum NotificationType {
  SPACE_INVITE
  DOC_SHARE
  DOC_PERMISSION_CHANGED
  SPACE_PERMISSION_CHANGED
  DOC_REMOVED
  SPACE_REMOVED
  COMMENT
  MENTION
  SYSTEM
}

model Notification {
  id         String           @id @default(cuid())
  receiverId String
  senderId   String?
  type       NotificationType
  title      String
  content    String?
  payload    Json?
  isRead     Boolean          @default(false)
  createdAt  DateTime         @default(now())

  receiver   User             @relation("receivedNotifications", fields: [receiverId], references: [id], onDelete: Cascade)
  sender     User?            @relation("sentNotifications", fields: [senderId], references: [id], onDelete: SetNull)

  @@index([receiverId, isRead])
  @@index([receiverId, createdAt(sort: Desc)])
  @@map("notifications")
}
```

- [ ] **Step 2: Add relation fields to User model**

In the `User` model (around line 11-25 of `schema.prisma`), add two new relation fields alongside the existing ones:

```prisma
model User {
  // ... existing fields
  receivedNotifications Notification[] @relation("receivedNotifications")
  sentNotifications     Notification[] @relation("sentNotifications")
}
```

- [ ] **Step 3: Generate Prisma client**

Run: `cd packages/database && npx prisma generate`
Expected: Prisma client regenerated successfully with the new Notification model and enum.

- [ ] **Step 4: Create and apply migration**

Run: `cd packages/database && npx prisma migrate dev --name add-notification`
Expected: Migration created and applied, `notifications` table exists in the database.

- [ ] **Step 5: Commit**

```bash
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations/
git commit -m "feat: add Notification model and NotificationType enum to Prisma schema"
```

---

### Task 2: Notification Database Queries

**Files:**
- Create: `packages/database/src/queries/notification.ts`
- Modify: `packages/database/src/queries.ts`

- [ ] **Step 1: Create notification query functions**

Create `packages/database/src/queries/notification.ts`:

```typescript
import { ChatSDKError } from "../errors.js";
import { prisma } from "../client.js";
import type { NotificationType } from "@prisma/client";

// ==================== Notification Functions ====================

export async function getNotifications({
  userId,
  page = 1,
  pageSize = 20,
  type,
}: {
  userId: string;
  page?: number;
  pageSize?: number;
  type?: NotificationType;
}) {
  try {
    const where = {
      receiverId: userId,
      ...(type ? { type } : {}),
    };

    const [list, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        include: {
          sender: {
            select: { id: true, name: true, avatarUrl: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({
        where: { receiverId: userId, isRead: false },
      }),
    ]);

    return { list, total, unreadCount };
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get notifications"
    );
  }
}

export async function getUnreadCount({ userId }: { userId: string }) {
  try {
    return await prisma.notification.count({
      where: { receiverId: userId, isRead: false },
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get unread count"
    );
  }
}

export async function createNotification({
  receiverId,
  senderId,
  type,
  title,
  content,
  payload,
}: {
  receiverId: string;
  senderId?: string | null;
  type: NotificationType;
  title: string;
  content?: string | null;
  payload?: Record<string, unknown> | null;
}) {
  try {
    return await prisma.notification.create({
      data: {
        receiverId,
        senderId: senderId ?? null,
        type,
        title,
        content: content ?? null,
        payload: payload ?? undefined,
      },
      include: {
        sender: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to create notification"
    );
  }
}

export async function markAsRead({
  notificationId,
  userId,
}: {
  notificationId: string;
  userId: string;
}) {
  try {
    return await prisma.notification.updateMany({
      where: {
        id: notificationId,
        receiverId: userId,
      },
      data: { isRead: true },
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to mark notification as read"
    );
  }
}

export async function markAllAsRead({ userId }: { userId: string }) {
  try {
    return await prisma.notification.updateMany({
      where: {
        receiverId: userId,
        isRead: false,
      },
      data: { isRead: true },
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to mark all notifications as read"
    );
  }
}
```

- [ ] **Step 2: Add re-export to queries barrel**

Add the following line to `packages/database/src/queries.ts`:

```typescript
export * from "./queries/notification.js";
```

- [ ] **Step 3: Verify build**

Run: `cd packages/database && pnpm build`
Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add packages/database/src/queries/notification.ts packages/database/src/queries.ts
git commit -m "feat: add notification query functions (CRUD + unread count)"
```

---

### Task 3: Notification REST API

**Files:**
- Create: `apps/server/src/http/routes/notification/index.ts`
- Create: `apps/server/src/http/routes/notification/handlers.ts`
- Modify: `apps/server/src/http/app.ts`

- [ ] **Step 1: Create route index**

Create `apps/server/src/http/routes/notification/index.ts`:

```typescript
import { Hono } from "hono";
import {
  listNotificationsHandler,
  unreadCountHandler,
  markAsReadHandler,
  markAllAsReadHandler,
  createWsTokenHandler,
} from "./handlers.js";

export const notificationRoutes = new Hono();

notificationRoutes.post("/ws-token", createWsTokenHandler);

// Static routes before parameterized
notificationRoutes.get("/unread-count", unreadCountHandler);
notificationRoutes.patch("/read-all", markAllAsReadHandler);

// Parameterized
notificationRoutes.patch("/:id/read", markAsReadHandler);

// Root
notificationRoutes.get("/", listNotificationsHandler);
```

- [ ] **Step 2: Create handlers**

Create `apps/server/src/http/routes/notification/handlers.ts`:

```typescript
import type { Context } from "hono";
import jwt from "jsonwebtoken";
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from "@repo/database";
import { getSessionFromRequest } from "../../../shared/auth.js";
import { ApiError } from "../../../shared/errors.js";
import type { NotificationType } from "@prisma/client";

export async function listNotificationsHandler(c: Context) {
  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:chat").toResponse();
  }

  try {
    const searchParams = new URL(c.req.url).searchParams;
    const page = Number(searchParams.get("page") || "1");
    const pageSize = Number(searchParams.get("pageSize") || "20");
    const typeParam = searchParams.get("type");

    const type = typeParam ? (typeParam as NotificationType) : undefined;

    const result = await getNotifications({
      userId: session.user.id,
      page,
      pageSize,
      type,
    });

    return c.json(result);
  } catch (error) {
    console.error("Failed to get notifications:", error);
    return new ApiError(
      "bad_request:api",
      "Failed to get notifications"
    ).toResponse();
  }
}

export async function unreadCountHandler(c: Context) {
  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:chat").toResponse();
  }

  try {
    const count = await getUnreadCount({ userId: session.user.id });
    return c.json({ count });
  } catch (error) {
    console.error("Failed to get unread count:", error);
    return new ApiError(
      "bad_request:api",
      "Failed to get unread count"
    ).toResponse();
  }
}

export async function markAsReadHandler(c: Context) {
  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:chat").toResponse();
  }

  try {
    const id = c.req.param("id")!;
    await markAsRead({ notificationId: id, userId: session.user.id });
    return c.json({ success: true });
  } catch (error) {
    console.error("Failed to mark notification as read:", error);
    return new ApiError(
      "bad_request:api",
      "Failed to mark notification as read"
    ).toResponse();
  }
}

export async function markAllAsReadHandler(c: Context) {
  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:chat").toResponse();
  }

  try {
    await markAllAsRead({ userId: session.user.id });
    return c.json({ success: true });
  } catch (error) {
    console.error("Failed to mark all as read:", error);
    return new ApiError(
      "bad_request:api",
      "Failed to mark all as read"
    ).toResponse();
  }
}

/**
 * Generate a short-lived JWT for the notification WebSocket connection.
 * Follows the same pattern as POST /api/collab/token.
 */
export async function createWsTokenHandler(c: Context) {
  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:chat").toResponse();
  }

  const secret = process.env.AUTH_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    return new ApiError("bad_request:api", "Server configuration error").toResponse();
  }

  const token = jwt.sign(
    { userId: session.user.id },
    secret,
    { expiresIn: "24h" }
  );

  return c.json({ token, expiresIn: 24 * 60 * 60 });
}
```

- [ ] **Step 3: Register route in app.ts**

In `apps/server/src/http/app.ts`, add the import and route registration. Add the import alongside existing imports:

```typescript
import { notificationRoutes } from "./routes/notification/index.js";
```

Add the route registration (after the existing routes, before `app.notFound`):

```typescript
app.route("/api/notifications", notificationRoutes);
```

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/http/routes/notification/ apps/server/src/http/app.ts
git commit -m "feat: add notification REST API endpoints (list, unread-count, mark-read, mark-all)"
```

---

### Task 4: WebSocket Connection Pool

**Files:**
- Create: `apps/server/src/ws/connection-pool.ts`

- [ ] **Step 1: Create connection pool**

Create `apps/server/src/ws/connection-pool.ts`:

```typescript
import type { IncomingMessage } from "node:http";
import type { WebSocket } from "ws";
import jwt from "jsonwebtoken";
import type { ApiTokenPayload } from "../shared/auth.js";

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

export function broadcast(userId: string, data: object): void {
  const conns = getConnections(userId);
  const message = JSON.stringify(data);
  for (const ws of conns) {
    if (ws.readyState === ws.OPEN) {
      ws.send(message);
    }
  }
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

    // Use AUTH_SECRET — same secret used to sign WS tokens (see POST /api/notifications/ws-token)
    const secret = process.env.AUTH_SECRET || process.env.JWT_SECRET;
    if (!secret) return null;

    const payload = jwt.verify(token, secret) as ApiTokenPayload;
    return payload.userId ?? null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Verify the server can import this module**

Run: `cd apps/server && pnpm build` (or check TypeScript compilation)
Expected: No import errors for the new module.

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/ws/connection-pool.ts
git commit -m "feat: add WebSocket connection pool for notification broadcast"
```

---

### Task 5: WebSocket Notification Route

**Files:**
- Create: `apps/server/src/ws/notification-ws.ts`
- Modify: `apps/server/src/index.ts`

- [ ] **Step 1: Create notification WebSocket handler**

Create `apps/server/src/ws/notification-ws.ts`:

```typescript
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
```

- [ ] **Step 2: Mount notification WebSocket in server entry**

Modify `apps/server/src/index.ts` to attach the notification WebSocket after the collab server. Add import:

```typescript
import { attachNotificationWs } from "./ws/notification-ws.js";
```

After the `attachCollabToHttpServer(...)` call, add:

```typescript
attachNotificationWs(httpServer as HttpServer, "/ws/notifications");
```

Update the console.log at the end to also show the notification WS URL:

```typescript
console.log(`[Server] Notification WebSocket running on ws://localhost:${serverConfig.httpPort}/ws/notifications`);
```

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/ws/notification-ws.ts apps/server/src/index.ts
git commit -m "feat: mount notification WebSocket on /ws/notifications with heartbeat"
```

---

### Task 6: Frontend API Client + Notification Hooks

**Files:**
- Modify: `apps/web/lib/api-client.ts`
- Create: `apps/web/hooks/use-notifications.ts`
- Create: `apps/web/hooks/use-notification-ws.ts`

- [ ] **Step 1: Add /api/notifications to SERVER_API_PREFIXES**

In `apps/web/lib/api-client.ts`, add `"/api/notifications"` to the `SERVER_API_PREFIXES` array (after the existing entries):

```typescript
const SERVER_API_PREFIXES = [
  // ... existing entries
  "/api/unsplash",
  "/api/notifications",  // ← add this
] as const;
```

- [ ] **Step 2: Create use-notifications.ts hook**

Create `apps/web/hooks/use-notifications.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

// Types
export interface NotificationUser {
  id: string;
  name: string | null;
  avatarUrl: string | null;
}

export interface Notification {
  id: string;
  receiverId: string;
  senderId: string | null;
  type: string;
  title: string;
  content: string | null;
  payload: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
  sender: NotificationUser | null;
}

export interface NotificationListResponse {
  list: Notification[];
  total: number;
  unreadCount: number;
}

// Query Keys
export const notificationKeys = {
  all: ["notifications"] as const,
  list: (params?: { page?: number; type?: string }) =>
    [...notificationKeys.all, "list", params] as const,
  unreadCount: () => [...notificationKeys.all, "unread-count"] as const,
};

// API Functions
async function fetchNotifications(params?: {
  page?: number;
  pageSize?: number;
  type?: string;
}): Promise<NotificationListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.append("page", String(params.page));
  if (params?.pageSize) searchParams.append("pageSize", String(params.pageSize));
  if (params?.type) searchParams.append("type", params.type);

  const response = await apiFetch(
    `/api/notifications?${searchParams.toString()}`
  );
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to fetch notifications");
  }
  return response.json();
}

async function fetchUnreadCount(): Promise<number> {
  const response = await apiFetch("/api/notifications/unread-count");
  if (!response.ok) {
    throw new Error("Failed to fetch unread count");
  }
  const data = await response.json();
  return data.count;
}

async function markNotificationAsRead(
  notificationId: string
): Promise<void> {
  const response = await apiFetch(
    `/api/notifications/${notificationId}/read`,
    { method: "PATCH" }
  );
  if (!response.ok) {
    throw new Error("Failed to mark notification as read");
  }
}

async function markAllNotificationsAsRead(): Promise<void> {
  const response = await apiFetch("/api/notifications/read-all", {
    method: "PATCH",
  });
  if (!response.ok) {
    throw new Error("Failed to mark all notifications as read");
  }
}

// Hooks
export function useNotifications(params?: {
  page?: number;
  type?: string;
}) {
  return useQuery({
    queryKey: notificationKeys.list(params),
    queryFn: () => fetchNotifications(params),
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: fetchUnreadCount,
    refetchInterval: false,
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markNotificationAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useMarkAllAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markAllNotificationsAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}
```

- [ ] **Step 3: Create use-notification-ws.ts hook**

Create `apps/web/hooks/use-notification-ws.ts`:

```typescript
"use client";

import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { notificationKeys } from "./use-notifications";

const MAX_RECONNECT_DELAY = 30_000;
const INITIAL_RECONNECT_DELAY = 1_000;

export function useNotificationWs(token: string | null) {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectDelayRef = useRef(INITIAL_RECONNECT_DELAY);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!token || !mountedRef.current) return;

    const wsOrigin =
      process.env.NEXT_PUBLIC_WS_ORIGIN ||
      process.env.NEXT_PUBLIC_API_ORIGIN?.replace(/^http/, "ws") ||
      "ws://localhost:4000";

    const ws = new WebSocket(`${wsOrigin}/ws/notifications?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectDelayRef.current = INITIAL_RECONNECT_DELAY;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "ping") {
          ws.send(JSON.stringify({ type: "pong" }));
          return;
        }
        if (data.type === "new_notification") {
          queryClient.invalidateQueries({
            queryKey: notificationKeys.all,
          });
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      // Exponential backoff reconnect
      reconnectTimerRef.current = setTimeout(() => {
        reconnectDelayRef.current = Math.min(
          reconnectDelayRef.current * 2,
          MAX_RECONNECT_DELAY
        );
        connect();
      }, reconnectDelayRef.current);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [token, queryClient]);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/api-client.ts apps/web/hooks/use-notifications.ts apps/web/hooks/use-notification-ws.ts
git commit -m "feat: add notification React Query hooks and WebSocket hook"
```

---

### Task 7: Notification UI Components

**Files:**
- Create: `apps/web/components/notification/notification-badge.tsx`
- Create: `apps/web/components/notification/notification-item.tsx`
- Create: `apps/web/components/notification/notification-list.tsx`
- Create: `apps/web/components/notification/notification-center.tsx`

- [ ] **Step 1: Create notification-badge.tsx**

Create `apps/web/components/notification/notification-badge.tsx`:

```tsx
"use client";

import { useUnreadCount } from "@/hooks/use-notifications";

export function NotificationBadge() {
  const { data: count = 0 } = useUnreadCount();

  if (count === 0) return null;

  return (
    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}
```

- [ ] **Step 2: Create notification-item.tsx**

Create `apps/web/components/notification/notification-item.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { Button } from "@repo/ui";
import { useMarkAsRead } from "@/hooks/use-notifications";
import type { Notification } from "@/hooks/use-notifications";
import { cn } from "@/lib/utils";

interface NotificationItemProps {
  notification: Notification;
  onClose: () => void;
}

export function NotificationItem({
  notification,
  onClose,
}: NotificationItemProps) {
  const router = useRouter();
  const markAsRead = useMarkAsRead();

  const handleClick = () => {
    if (!notification.isRead) {
      markAsRead.mutate(notification.id);
    }
  };

  const handleAcceptInvite = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Navigate to invite accept page
    const payload = notification.payload as Record<string, unknown>;
    if (payload?.inviteToken) {
      router.push(`/invite/${payload.inviteToken}`);
      markAsRead.mutate(notification.id);
      onClose();
    }
  };

  const handleRejectInvite = (e: React.MouseEvent) => {
    e.stopPropagation();
    markAsRead.mutate(notification.id);
  };

  const handleViewDocument = (e: React.MouseEvent) => {
    e.stopPropagation();
    const payload = notification.payload as Record<string, unknown>;
    if (payload?.documentId) {
      // Find workspace slug from current URL or use document ID
      router.push(`/documents/${payload.documentId}`);
      markAsRead.mutate(notification.id);
      onClose();
    }
  };

  const timeAgo = formatTimeAgo(notification.createdAt);

  return (
    <div
      onClick={handleClick}
      className={cn(
        "flex cursor-pointer flex-col gap-1 px-4 py-3 transition-colors hover:bg-muted/50",
        !notification.isRead && "bg-muted/30"
      )}
    >
      <div className="flex items-start gap-2">
        {!notification.isRead && (
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-red-500" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-tight">
            {notification.title}
          </p>
          {notification.content && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {notification.content}
            </p>
          )}
          <div className="flex items-center gap-2 mt-1.5">
            {notification.type === "SPACE_INVITE" && (
              <>
                <Button
                  size="sm"
                  variant="default"
                  className="h-6 px-2 text-xs"
                  onClick={handleAcceptInvite}
                >
                  接受
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-xs"
                  onClick={handleRejectInvite}
                >
                  拒绝
                </Button>
              </>
            )}
            {notification.type === "DOC_SHARE" && (
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-xs"
                onClick={handleViewDocument}
              >
                查看文档
              </Button>
            )}
            <span className="text-[11px] text-muted-foreground ml-auto">
              {timeAgo}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return "刚刚";
  if (diff < hour) return `${Math.floor(diff / minute)}分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)}小时前`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}天前`;
  return new Date(dateStr).toLocaleDateString("zh-CN");
}
```

- [ ] **Step 3: Create notification-list.tsx**

Create `apps/web/components/notification/notification-list.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useNotifications, useMarkAllAsRead } from "@/hooks/use-notifications";
import { NotificationItem } from "./notification-item";
import { Button, ScrollArea } from "@repo/ui";

const TABS = [
  { key: undefined, label: "全部" },
  { key: "invite", label: "邀请" },
  { key: "permission", label: "权限" },
] as const;

// Map tab key to NotificationType filter values
function getTabType(tabKey: string | undefined): string | undefined {
  switch (tabKey) {
    case "invite":
      return "SPACE_INVITE";
    case "permission":
      return "DOC_PERMISSION_CHANGED";
    default:
      return undefined;
  }
}

interface NotificationListProps {
  onClose: () => void;
}

export function NotificationList({ onClose }: NotificationListProps) {
  const [activeTab, setActiveTab] = useState<string | undefined>(undefined);
  const type = getTabType(activeTab);
  const { data, isLoading } = useNotifications({ type });
  const markAllAsRead = useMarkAllAsRead();

  const notifications = data?.list ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="text-sm font-semibold">通知</h3>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-auto px-2 py-1 text-xs text-muted-foreground"
            onClick={() => markAllAsRead.mutate()}
          >
            全部已读
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b px-4 py-2">
        {TABS.map((tab) => (
          <button
            key={tab.key ?? "all"}
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* List */}
      <ScrollArea className="h-[380px]">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            加载中...
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            暂无通知
          </div>
        ) : (
          <div className="divide-y">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onClose={onClose}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
```

- [ ] **Step 4: Create notification-center.tsx**

Create `apps/web/components/notification/notification-center.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui";
import { NotificationBadge } from "./notification-badge";
import { NotificationList } from "./notification-list";

export function NotificationCenter() {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative flex items-center">
          <Bell className="size-4" />
          <NotificationBadge />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="right"
        sideOffset={8}
        className="w-[380px] p-0"
      >
        <NotificationList onClose={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/notification/
git commit -m "feat: add notification UI components (badge, item, list, center popover)"
```

---

### Task 8: Sidebar Entry + NotificationProvider

**Files:**
- Modify: `apps/web/components/app-sidebar.tsx`
- Modify: `apps/web/app/(workbench)/layout.tsx`

- [ ] **Step 1: Add notification entry to sidebar**

In `apps/web/components/app-sidebar.tsx`, add the notification entry after the "所有文档" menu item (after the `<SidebarMenuItem>` that renders the FileText icon and "所有文档" text, around line 137).

Add import at the top of the file:

```typescript
import { NotificationCenter } from "@/components/notification/notification-center";
```

After the "所有文档" `SidebarMenuItem` (after line 137 `</SidebarMenuItem>`), add:

```tsx
<SidebarMenuItem>
  <SidebarMenuButton asChild>
    <NotificationCenter />
  </SidebarMenuButton>
</SidebarMenuItem>
```

- [ ] **Step 2: Create NotificationProvider and add to layout**

In `apps/web/app/(workbench)/layout.tsx`, we need to add a client component that provides the WebSocket connection.

First, create a new file `apps/web/components/notification-provider.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useNotificationWs } from "@/hooks/use-notification-ws";
import { apiFetch } from "@/lib/api-client";

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchToken() {
      try {
        const res = await apiFetch("/api/notifications/ws-token", {
          method: "POST",
        });
        if (res.ok && !cancelled) {
          const data = await res.json();
          setToken(data.token);
        }
      } catch {
        // Silently fail — WS will retry
      }
    }
    fetchToken();
    return () => { cancelled = true; };
  }, []);

  useNotificationWs(token);

  return <>{children}</>;
}
```

Then modify `apps/web/app/(workbench)/layout.tsx` to wrap with `NotificationProvider`. The layout needs to become partly client-side for the provider. Since the layout is a server component, we'll wrap the children inside the SidebarInset with the provider.

Add import:

```typescript
import { NotificationProvider } from "@/components/notification-provider";
```

Wrap the `{children}` inside `SidebarInset` with `NotificationProvider`:

```tsx
<SidebarInset>
  <NotificationProvider>
    {children}
    <MaterialLibraryDialog />
    <DocumentLinkPickerDialog />
  </NotificationProvider>
</SidebarInset>
```

- [ ] **Step 3: Verify frontend builds**

Run: `cd apps/web && pnpm build`
Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/app-sidebar.tsx apps/web/components/notification-provider.tsx apps/web/app/\(workbench\)/layout.tsx
git commit -m "feat: add notification entry to sidebar with WebSocket provider"
```

---

### Task 9: Notification Triggers — Workspace Handlers

**Files:**
- Modify: `apps/server/src/http/routes/workspaces/handlers.ts`

- [ ] **Step 1: Add notification imports to workspace handlers**

At the top of `apps/server/src/http/routes/workspaces/handlers.ts`, add imports for notification functions and broadcast:

```typescript
import { createNotification } from "@repo/database";
import { broadcast } from "../../../ws/connection-pool.js";
```

- [ ] **Step 2: Add SPACE_INVITE notification in createInviteHandler**

In `createInviteHandler`, after the `prisma.workspaceInvite.create(...)` call (after the `const invite = await prisma.workspaceInvite.create(...)` block), before the `return c.json(...)` line, add:

```typescript
    // Look up invited user by email to send notification
    const invitedUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (invitedUser) {
      const workspace = await prisma.workspace.findUnique({
        where: { id },
        select: { name: true },
      });

      const notification = await createNotification({
        receiverId: invitedUser.id,
        senderId: session.user.id,
        type: "SPACE_INVITE",
        title: `${session.user.name} 邀请你加入空间「${workspace?.name ?? "未知空间"}」`,
        content: workspace?.name ?? null,
        payload: {
          workspaceId: id,
          workspaceName: workspace?.name,
          inviteToken: invite.token,
          role: role || "member",
          permission: permission || "view",
        },
      });

      broadcast(invitedUser.id, {
        type: "new_notification",
        notification,
      });
    }
```

- [ ] **Step 3: Add SPACE_PERMISSION_CHANGED notification in updateMemberHandler**

In `updateMemberHandler`, after the `const member = await updateWorkspaceMemberRole(...)` call and before `return c.json(member)`, add:

```typescript
    const workspaceInfo = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true },
    });

    const notification = await createNotification({
      receiverId: userId,
      senderId: session.user.id,
      type: "SPACE_PERMISSION_CHANGED",
      title: `你的空间权限已变更`,
      content: `${workspaceInfo?.name ?? "空间"}: ${targetMember.role ?? ""} → ${nextRole ?? targetMember.role}`,
      payload: {
        workspaceId,
        workspaceName: workspaceInfo?.name,
        oldRole: targetMember.role,
        newRole: nextRole,
        oldPermission: targetMember.permission,
        newPermission: nextRole === "admin" ? "edit" : permission,
      },
    });

    broadcast(userId, {
      type: "new_notification",
      notification,
    });
```

Note: `userId` here is the `userId` from the request body (the target member being updated), and `targetMember` is already fetched earlier in the handler.

- [ ] **Step 4: Add SPACE_REMOVED notification in removeMemberHandler**

In `removeMemberHandler`, after `await removeWorkspaceMember(...)` and before `return c.json({ success: true })`, add:

```typescript
    const workspaceInfo = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true },
    });

    // Only notify if the removed user is not the one doing the removing (self-leave)
    if (userId !== session.user.id) {
      const notification = await createNotification({
        receiverId: userId,
        senderId: session.user.id,
        type: "SPACE_REMOVED",
        title: `你已被移出空间`,
        content: workspaceInfo?.name ?? null,
        payload: {
          workspaceId,
          workspaceName: workspaceInfo?.name,
        },
      });

      broadcast(userId, {
        type: "new_notification",
        notification,
      });
    }
```

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/http/routes/workspaces/handlers.ts
git commit -m "feat: add notification triggers for workspace invite, permission change, and member removal"
```

---

### Task 10: Notification Triggers — Editor Document Handlers

**Files:**
- Modify: `apps/server/src/http/routes/editor-documents/handlers.ts`

- [ ] **Step 1: Add notification imports to editor-document handlers**

At the top of `apps/server/src/http/routes/editor-documents/handlers.ts`, add imports:

```typescript
import { createNotification } from "@repo/database";
import { broadcast } from "../../../ws/connection-pool.js";
```

- [ ] **Step 2: Add DOC_SHARE notification in addCollaboratorHandler**

In `addCollaboratorHandler`, after the `prisma.documentCollaborator.create(...)` call and before `return c.json(collaborator, 201)`, add:

```typescript
    // Send notification to the invited user if they have an account
    if (invitedUser) {
      const document = await prisma.editorDocument.findUnique({
        where: { id: documentId },
        select: { title: true },
      });

      const notification = await createNotification({
        receiverId: invitedUser.id,
        senderId: session.user.id,
        type: "DOC_SHARE",
        title: `${session.user.name} 分享了文档给你`,
        content: document?.title ?? null,
        payload: {
          documentId,
          documentTitle: document?.title,
        },
      });

      broadcast(invitedUser.id, {
        type: "new_notification",
        notification,
      });
    }
```

Note: `invitedUser` is already fetched earlier in the handler (it's the result of `prisma.user.findUnique({ where: { email } })`).

- [ ] **Step 3: Add DOC_PERMISSION_CHANGED notification in updateCollaboratorHandler**

In `updateCollaboratorHandler`, after the `prisma.documentCollaborator.update(...)` call and before `return c.json(collaborator, 200)`, add:

```typescript
    // Notify the collaborator about permission change
    if (collaborator.userId) {
      const document = await prisma.editorDocument.findUnique({
        where: { id: documentId },
        select: { title: true },
      });

      const notification = await createNotification({
        receiverId: collaborator.userId,
        senderId: session.user.id,
        type: "DOC_PERMISSION_CHANGED",
        title: `你的文档权限已变更`,
        content: `${document?.title ?? "文档"}: ${collaborator.permission} → ${permission}`,
        payload: {
          documentId,
          documentTitle: document?.title,
          oldPermission: collaborator.permission,
          newPermission: permission,
        },
      });

      broadcast(collaborator.userId, {
        type: "new_notification",
        notification,
      });
    }
```

Note: The `collaborator` variable here is the result of `prisma.documentCollaborator.update(...)`, which includes the `userId` field. The old permission is accessible from the collaborator object before the update. To capture the old permission, we need to store it before the update call. Adjust the handler to save the old permission before the update:

Before the update call, add:
```typescript
    const oldPermission = collaborator.permission;
```

Then use `oldPermission` in the notification content and payload.

- [ ] **Step 4: Add DOC_REMOVED notification in removeCollaboratorHandler**

In `removeCollaboratorHandler`, after the `prisma.documentCollaborator.delete(...)` call and before `return c.json({ success: true }, 200)`, add:

```typescript
    // Notify the removed collaborator
    if (collaborator.userId) {
      const document = await prisma.editorDocument.findUnique({
        where: { id: documentId },
        select: { title: true },
      });

      const notification = await createNotification({
        receiverId: collaborator.userId,
        senderId: session.user.id,
        type: "DOC_REMOVED",
        title: `你已被移出文档`,
        content: document?.title ?? null,
        payload: {
          documentId,
          documentTitle: document?.title,
        },
      });

      broadcast(collaborator.userId, {
        type: "new_notification",
        notification,
      });
    }
```

Note: `collaborator` is fetched before the delete call, so it still has `userId` available.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/http/routes/editor-documents/handlers.ts
git commit -m "feat: add notification triggers for document share, permission change, and removal"
```

---

## Integration Notes

### WebSocket Token for Frontend

The notification WebSocket authenticates via JWT in the URL query string (`?token=xxx`), following the same pattern as the collab WebSocket (`POST /api/collab/token`).

The flow:
1. `NotificationProvider` calls `POST /api/notifications/ws-token` on mount
2. Server verifies the session cookie, generates a JWT signed with `AUTH_SECRET` (24h expiry)
3. Frontend passes the token to `useNotificationWs(token)`
4. The hook connects to `ws://server/ws/notifications?token=xxx`
5. `connection-pool.ts` verifies the JWT with the same `AUTH_SECRET`

### Environment Variables

Ensure these are set (both likely already exist):
- `AUTH_SECRET` — Used for JWT signing/verification (NextAuth secret, already configured)
- `NEXT_PUBLIC_API_ORIGIN` — Server API origin (used to derive WS origin)

### Auth Secret Consistency

The WS token endpoint (`POST /api/notifications/ws-token`) and `extractUserIdFromToken()` in `connection-pool.ts` both use `AUTH_SECRET || JWT_SECRET`. This matches the existing collab token pattern (`apps/server/src/http/routes/collab/handlers.ts:34`).

---

## Self-Review Checklist

- [x] All 6 notification types from the spec are covered (SPACE_INVITE, DOC_SHARE, DOC_PERMISSION_CHANGED, SPACE_PERMISSION_CHANGED, DOC_REMOVED, SPACE_REMOVED)
- [x] All REST endpoints match the spec (GET /, GET /unread-count, PATCH /:id/read, PATCH /read-all)
- [x] WebSocket path matches spec (/ws/notifications)
- [x] Heartbeat matches spec (30s ping, 60s timeout)
- [x] Frontend components match spec layout (Popover, 380px width, ScrollArea)
- [x] All trigger points match spec file locations
- [x] Query functions match spec (getNotifications, getUnreadCount, createNotification, markAsRead, markAllAsRead)
- [x] Exponential backoff reconnect matches spec (1s → 2s → 4s → 8s → max 30s)
- [x] Tabs include "全部", "邀请", "权限" as specified for Phase 1
- [x] Payload structures match spec table
