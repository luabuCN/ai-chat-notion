import { Hono } from "hono";
import { uploadFileHandler } from "./handlers.js";

export const filesRoutes = new Hono();

filesRoutes.post("/upload", uploadFileHandler);
