import { Hono } from "hono";
import { listModelsHandler } from "./handlers.js";

export const modelRoutes = new Hono();

modelRoutes.get("/", listModelsHandler);
