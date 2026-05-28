import { Hono } from "hono";
import { getDocumentsHandler } from "./handlers.js";

export const documentsRoutes = new Hono();

documentsRoutes.get("/", getDocumentsHandler);
