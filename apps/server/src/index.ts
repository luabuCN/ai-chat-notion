import { Hono } from "hono";
import { app } from "./http/app.js";

if (!(app instanceof Hono)) {
  throw new Error("Expected a Hono application instance");
}

export default app;
