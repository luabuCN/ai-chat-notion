import { Hono } from "hono";
import { getVotesHandler, patchVoteHandler } from "./handlers.js";

export const voteRoutes = new Hono();

voteRoutes.get("/", getVotesHandler);
voteRoutes.patch("/", patchVoteHandler);
