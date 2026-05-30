import { Hono } from "hono";
import {
  deleteChatHandler,
  getChatHandler,
  getChatMessagesHandler,
  getChatStreamHandler,
  getChatTitleHandler,
  postChatHandler,
} from "./handlers.js";

export { getStreamContext } from "./handlers.js";

export const chatRoutes = new Hono();

chatRoutes.post("/", postChatHandler);
chatRoutes.delete("/", deleteChatHandler);
chatRoutes.get("/:id", getChatHandler);
chatRoutes.get("/:id/messages", getChatMessagesHandler);
chatRoutes.get("/:id/title", getChatTitleHandler);
chatRoutes.get("/:id/stream", getChatStreamHandler);
