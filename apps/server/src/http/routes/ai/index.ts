import { Hono } from "hono";
import { completionHandler } from "./handlers.js";

export const aiRoutes = new Hono();

aiRoutes.post("/completion", completionHandler);
