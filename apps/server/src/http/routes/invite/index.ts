import { Hono } from "hono";
import { getInviteHandler, joinWorkspaceHandler } from "./handlers.js";

export const inviteRoutes = new Hono();

inviteRoutes.get("/:code", getInviteHandler);
inviteRoutes.post("/join", joinWorkspaceHandler);
