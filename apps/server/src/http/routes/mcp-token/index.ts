import { Hono } from "hono";
import {
  getMcpTokenHandler,
  createMcpTokenHandler,
  deleteMcpTokenHandler,
} from "./handlers.js";

export const mcpTokenRoutes = new Hono();

mcpTokenRoutes.get("/", getMcpTokenHandler);
mcpTokenRoutes.post("/", createMcpTokenHandler);
mcpTokenRoutes.delete("/", deleteMcpTokenHandler);
