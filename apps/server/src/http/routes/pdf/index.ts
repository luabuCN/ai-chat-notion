import { Hono } from "hono";
import { parsePdfHandler } from "./handlers.js";

export const pdfRoutes = new Hono();

pdfRoutes.post("/parse", parsePdfHandler);
