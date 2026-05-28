import { Hono } from "hono";
import {
  listWorkspacesHandler,
  createWorkspaceHandler,
  updateWorkspaceHandler,
  deleteWorkspaceHandler,
  updateWorkspaceByIdHandler,
  deleteWorkspaceByIdHandler,
  listMembersHandler,
  addMemberHandler,
  updateMemberHandler,
  removeMemberHandler,
  createInviteHandler,
  switchWorkspaceHandler,
} from "./handlers.js";

export const workspaceRoutes = new Hono();

// Static routes first
workspaceRoutes.get("/members", listMembersHandler);
workspaceRoutes.post("/members", addMemberHandler);
workspaceRoutes.patch("/members", updateMemberHandler);
workspaceRoutes.delete("/members", removeMemberHandler);
workspaceRoutes.post("/switch", switchWorkspaceHandler);

// Parameterized routes
workspaceRoutes.post("/:id/invite", createInviteHandler);
workspaceRoutes.patch("/:id", updateWorkspaceByIdHandler);
workspaceRoutes.delete("/:id", deleteWorkspaceByIdHandler);

// Root routes
workspaceRoutes.get("/", listWorkspacesHandler);
workspaceRoutes.post("/", createWorkspaceHandler);
workspaceRoutes.patch("/", updateWorkspaceHandler);
workspaceRoutes.delete("/", deleteWorkspaceHandler);
