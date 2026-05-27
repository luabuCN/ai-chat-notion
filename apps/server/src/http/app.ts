import { Hono } from "hono";
import { logger } from "hono/logger";
import { serverCors } from "./middleware/cors.js";
import { ApiError } from "../shared/errors.js";
import { aiRoutes } from "./routes/ai.js";
import { chatRoutes } from "./routes/chat.js";
import { collabRoutes } from "./routes/collab.js";
import { historyRoutes } from "./routes/history.js";
import { modelRoutes } from "./routes/models.js";

export const app = new Hono();

app.use("*", logger());
app.use("*", serverCors);

app.get("/ping", (c) => c.text("pong"));

app.route("/api/ai", aiRoutes);
app.route("/api/chat", chatRoutes);
app.route("/api/collab", collabRoutes);
app.route("/api/history", historyRoutes);
app.route("/api/models", modelRoutes);

app.notFound(() =>
  new ApiError("not_found:api", "Route not found").toResponse()
);

app.onError((error) => {
  if (error instanceof ApiError) {
    return error.toResponse();
  }

  console.error("[HTTP] Unhandled error:", error);
  return new ApiError("offline:api").toResponse();
});
