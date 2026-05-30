import { Hono } from "hono";
import { completionHandler, openaiHandler } from "./handlers.js";

export const aiRoutes = new Hono();

aiRoutes.post("/completion", completionHandler);
aiRoutes.post("/openai", openaiHandler);
