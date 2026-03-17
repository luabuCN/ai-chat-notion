import type { Config, Context } from "@netlify/functions";

export default async (req: Request, context: Context) => {
  return new Response("Hello, world!")
};

export const config: Config = {
  path: "/api/hello",
};