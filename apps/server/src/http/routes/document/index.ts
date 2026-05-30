import { Hono } from "hono";
import { getDocumentHandler, postDocumentHandler, deleteDocumentHandler } from "./handlers.js";

export const documentRoutes = new Hono();

documentRoutes.get("/", getDocumentHandler);
documentRoutes.post("/", postDocumentHandler);
documentRoutes.delete("/", deleteDocumentHandler);
