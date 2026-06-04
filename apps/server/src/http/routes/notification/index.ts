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
