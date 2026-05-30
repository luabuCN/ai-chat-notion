import { Hono } from "hono";
import { uploadthingHandler } from "./handlers.js";

export const uploadthingRoutes = new Hono();

uploadthingRoutes.get("/", uploadthingHandler);
uploadthingRoutes.post("/", uploadthingHandler);
