import { Hono } from "hono";
import {
  createWebScrapeJobHandler,
  scrapeWebPageHandler,
} from "./handlers.js";

export const webScrapeRoutes = new Hono();

webScrapeRoutes.post("/jobs", createWebScrapeJobHandler);
webScrapeRoutes.post("/", scrapeWebPageHandler);
