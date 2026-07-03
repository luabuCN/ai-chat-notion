import { Hono } from "hono";
import {
  createImageGenerationHandler,
  deleteImageHistoryHandler,
  getImageHistoryHandler,
  getImageTaskHandler,
} from "./handlers.js";

export const imageRoutes = new Hono();

imageRoutes.post("/generations", createImageGenerationHandler);
imageRoutes.get("/history", getImageHistoryHandler);
imageRoutes.delete("/history/:id", deleteImageHistoryHandler);
imageRoutes.get("/tasks/:id", getImageTaskHandler);
