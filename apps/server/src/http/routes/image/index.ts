import { Hono } from "hono";
import {
  createImageGenerationHandler,
  getImageHistoryHandler,
  getImageTaskHandler,
} from "./handlers.js";

export const imageRoutes = new Hono();

imageRoutes.post("/generations", createImageGenerationHandler);
imageRoutes.get("/history", getImageHistoryHandler);
imageRoutes.get("/tasks/:id", getImageTaskHandler);
