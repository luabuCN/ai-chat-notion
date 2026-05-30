import { Hono } from "hono";
import { searchUnsplashHandler } from "./handlers.js";

export const unsplashRoutes = new Hono();

unsplashRoutes.get("/", searchUnsplashHandler);
