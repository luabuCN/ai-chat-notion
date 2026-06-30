import type { Server as HttpServer } from "node:http";
import { createVercelHttpServer } from "./bootstrap-http-server.js";

const { httpServer } = await createVercelHttpServer();

export default httpServer satisfies HttpServer;
