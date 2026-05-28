import { Hono } from "hono";
import { getUserHandler } from "./handlers.js";

export const usersRoutes = new Hono();

usersRoutes.get("/:id", getUserHandler);
