import { Hono } from "hono";
import { createTokenHandler } from "./handlers.js";

export const collabRoutes = new Hono();

collabRoutes.post("/token", createTokenHandler);
