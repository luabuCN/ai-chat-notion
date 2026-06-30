import { Hono } from "hono";
import type { Server as HttpServer } from "node:http";
import { app } from "./http/app.js";
import { createVercelHttpServer } from "./bootstrap-http-server.js";

if (!(app instanceof Hono)) {
  throw new Error("Expected a Hono application instance");
}

const { httpServer } = await createVercelHttpServer();

export default httpServer satisfies HttpServer;
