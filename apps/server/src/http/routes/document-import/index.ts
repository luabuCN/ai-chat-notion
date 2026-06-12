import { Hono } from "hono";
import { parseDocumentImportHandler } from "./handlers.js";

export const documentImportRoutes = new Hono();

documentImportRoutes.post("/parse", parseDocumentImportHandler);

