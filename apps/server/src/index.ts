import { Hono } from "hono";
import { app } from "./http/app.js";

export default app;

// Referenced so the entry module imports `hono` (required by Vercel detection).
export type HonoEntry = Hono;
