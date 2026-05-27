import { Hono } from "hono";
import { logger } from "hono/logger";
import { serverCors } from "./middleware/cors.js";
import { ApiError } from "../shared/errors.js";
import { aiRoutes } from "./routes/ai/index.js";
import { chatRoutes } from "./routes/chat/index.js";
import { collabRoutes } from "./routes/collab/index.js";
import { historyRoutes } from "./routes/history/index.js";
import { modelRoutes } from "./routes/models/index.js";

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
