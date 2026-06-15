import { Hono } from "hono";
import { scrapeWebPageHandler } from "./handlers.js";

export const webScrapeRoutes = new Hono();

webScrapeRoutes.post("/", scrapeWebPageHandler);
