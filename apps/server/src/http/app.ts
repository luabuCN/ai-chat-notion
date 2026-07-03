import { Hono } from "hono";
import { logger } from "hono/logger";
import { serverCors } from "./middleware/cors.js";
import { ApiError } from "../shared/errors.js";
import { aiRoutes } from "./routes/ai/index.js";
import { chatRoutes } from "./routes/chat/index.js";
import { collabRoutes } from "./routes/collab/index.js";
import { historyRoutes } from "./routes/history/index.js";
import { modelRoutes } from "./routes/models/index.js";
import { workspaceRoutes } from "./routes/workspaces/index.js";
import { editorDocumentRoutes } from "./routes/editor-documents/index.js";
import { documentRoutes } from "./routes/document/index.js";
import { documentsRoutes } from "./routes/documents/index.js";
import { voteRoutes } from "./routes/vote/index.js";
import { suggestionRoutes } from "./routes/suggestions/index.js";
import { inviteRoutes } from "./routes/invite/index.js";
import { usersRoutes } from "./routes/users/index.js";
import { uploadthingRoutes } from "./routes/uploadthing/index.js";
import { filesRoutes } from "./routes/files/index.js";
import { pdfRoutes } from "./routes/pdf/index.js";
import { documentImportRoutes } from "./routes/document-import/index.js";
import { webScrapeRoutes } from "./routes/web-scrape/index.js";
import { imageRoutes } from "./routes/image/index.js";
import { unsplashRoutes } from "./routes/unsplash/index.js";
import { notificationRoutes } from "./routes/notification/index.js";
import { tokenUsageRoutes } from "./routes/token-usage/index.js";
import { jobRoutes } from "./routes/jobs/index.js";

export const app = new Hono();

app.use("*", logger());
app.use("*", serverCors);

app.get("/ping", (c) => c.text("pong"));

app.route("/api/ai", aiRoutes);
app.route("/api/chat", chatRoutes);
app.route("/api/collab", collabRoutes);
app.route("/api/history", historyRoutes);
app.route("/api/models", modelRoutes);
app.route("/api/workspaces", workspaceRoutes);
app.route("/api/editor-documents", editorDocumentRoutes);
app.route("/api/document", documentRoutes);
app.route("/api/documents", documentsRoutes);
app.route("/api/vote", voteRoutes);
app.route("/api/suggestions", suggestionRoutes);
app.route("/api/invite", inviteRoutes);
app.route("/api/users", usersRoutes);
app.route("/api/uploadthing", uploadthingRoutes);
app.route("/api/files", filesRoutes);
app.route("/api/pdf", pdfRoutes);
app.route("/api/document-import", documentImportRoutes);
app.route("/api/web-scrape", webScrapeRoutes);
app.route("/api/image", imageRoutes);
app.route("/api/unsplash", unsplashRoutes);
app.route("/api/notifications", notificationRoutes);
app.route("/api/token-usage", tokenUsageRoutes);
app.route("/api/jobs", jobRoutes);

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
