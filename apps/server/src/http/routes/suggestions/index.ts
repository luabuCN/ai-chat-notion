import { Hono } from "hono";
import { getSuggestionsHandler } from "./handlers.js";

export const suggestionRoutes = new Hono();

suggestionRoutes.get("/", getSuggestionsHandler);
