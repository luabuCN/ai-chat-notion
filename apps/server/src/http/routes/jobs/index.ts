import { Hono } from "hono";
import { getJobStatusHandler } from "./handlers.js";

export const jobRoutes = new Hono();

jobRoutes.get("/:jobId", getJobStatusHandler);
