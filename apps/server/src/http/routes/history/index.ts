import { Hono } from "hono";
import { deleteAllHistoryHandler, listHistoryHandler } from "./handlers.js";

export const historyRoutes = new Hono();

historyRoutes.get("/", listHistoryHandler);
historyRoutes.delete("/", deleteAllHistoryHandler);
