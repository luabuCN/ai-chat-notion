import { Hono } from "hono";
import { getTokenUsageHandler } from "./handlers.js";

export const tokenUsageRoutes = new Hono();

tokenUsageRoutes.get("/", getTokenUsageHandler);
