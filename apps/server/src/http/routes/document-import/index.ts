import { Hono } from "hono";
import {
  createDocumentImportJobHandler,
  parseDocumentImportHandler,
} from "./handlers.js";

export const documentImportRoutes = new Hono();

documentImportRoutes.post("/jobs", createDocumentImportJobHandler);
documentImportRoutes.post("/parse", parseDocumentImportHandler);

