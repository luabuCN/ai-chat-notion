import { Hono } from "hono";
import {
  listEditorDocumentsHandler,
  createEditorDocumentHandler,
  getAllDocumentsHandler,
  getSharedWithMeHandler,
  getEditorDocumentHandler,
  getPublishedDocumentPreviewHandler,
  updateEditorDocumentHandler,
  deleteEditorDocumentHandler,
  getCollaboratorsHandler,
  addCollaboratorHandler,
  updateCollaboratorHandler,
  removeCollaboratorHandler,
  duplicateEditorDocumentHandler,
  moveEditorDocumentHandler,
  getEditorDocumentPathHandler,
  enablePublicEditHandler,
  disablePublicEditHandler,
  publishEditorDocumentHandler,
  unpublishEditorDocumentHandler,
  restoreEditorDocumentHandler,
  recordVisitHandler,
  getCollaboratorInviteHandler,
  acceptCollaboratorInviteHandler,
  getMentionableUsersHandler,
  createCommentNotificationHandler,
} from "./handlers.js";

export const editorDocumentRoutes = new Hono();

// Static paths MUST come BEFORE parameterized /:id routes
editorDocumentRoutes.get("/all", getAllDocumentsHandler);
editorDocumentRoutes.get("/shared-with-me", getSharedWithMeHandler);
editorDocumentRoutes.get(
  "/collaborator-invite/:token",
  getCollaboratorInviteHandler
);
editorDocumentRoutes.post(
  "/collaborator-invite/:token",
  acceptCollaboratorInviteHandler
);

// Root CRUD
editorDocumentRoutes.get("/", listEditorDocumentsHandler);
editorDocumentRoutes.post("/", createEditorDocumentHandler);

// Parameterized routes
editorDocumentRoutes.get("/:id", getEditorDocumentHandler);
editorDocumentRoutes.patch("/:id", updateEditorDocumentHandler);
editorDocumentRoutes.delete("/:id", deleteEditorDocumentHandler);

// Sub-routes on /:id
editorDocumentRoutes.get("/:id/preview", getPublishedDocumentPreviewHandler);
editorDocumentRoutes.get("/:id/collaborators", getCollaboratorsHandler);
editorDocumentRoutes.post("/:id/collaborators", addCollaboratorHandler);
editorDocumentRoutes.patch("/:id/collaborators", updateCollaboratorHandler);
editorDocumentRoutes.delete("/:id/collaborators", removeCollaboratorHandler);
editorDocumentRoutes.post("/:id/duplicate", duplicateEditorDocumentHandler);
editorDocumentRoutes.post("/:id/move", moveEditorDocumentHandler);
editorDocumentRoutes.get("/:id/path", getEditorDocumentPathHandler);
editorDocumentRoutes.post("/:id/public-edit", enablePublicEditHandler);
editorDocumentRoutes.delete("/:id/public-edit", disablePublicEditHandler);
editorDocumentRoutes.post("/:id/publish", publishEditorDocumentHandler);
editorDocumentRoutes.delete("/:id/publish", unpublishEditorDocumentHandler);
editorDocumentRoutes.post("/:id/restore", restoreEditorDocumentHandler);
editorDocumentRoutes.post("/:id/visit", recordVisitHandler);

// Comment @mention
editorDocumentRoutes.get("/:id/mentionable-users", getMentionableUsersHandler);
editorDocumentRoutes.post("/:id/comments", createCommentNotificationHandler);
