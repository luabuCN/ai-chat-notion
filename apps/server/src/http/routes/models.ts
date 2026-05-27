import { Hono } from "hono";
import OpenAI from "openai";

export interface ModelInfo {
  provider: string;
  model: string;
  full_slug: string;
  context_length: number;
  supports_image_in: boolean;
  supports_video_in: boolean;
  supports_reasoning: boolean;
  raw: {
    context_length: number | null;
    supports_image_in: boolean | null;
    supports_video_in: boolean | null;
    supports_reasoning: boolean | null;
  };
}

export const modelRoutes = new Hono();

modelRoutes.get("/", async (c) => {
  try {
    const client = new OpenAI({
      apiKey: process.env.API_KEY || "",
      baseURL: "https://api.moonshot.cn/v1",
    });

    const modelList = await client.models.list();
    const result: ModelInfo[] = [];

    for await (const model of modelList) {
      const supportsReasoning =
        "supports_reasoning" in model &&
        typeof model.supports_reasoning === "boolean"
          ? model.supports_reasoning
          : model.id.toLowerCase().includes("thinking");

      result.push({
        provider: "moonshot",
        model: model.id,
        full_slug: model.id,
        context_length:
          "context_length" in model && typeof model.context_length === "number"
            ? model.context_length
            : 0,
        supports_image_in:
          "supports_image_in" in model &&
          typeof model.supports_image_in === "boolean"
            ? model.supports_image_in
            : false,
        supports_video_in:
          "supports_video_in" in model &&
          typeof model.supports_video_in === "boolean"
            ? model.supports_video_in
            : false,
        supports_reasoning: supportsReasoning,
        raw: {
          context_length:
            "context_length" in model &&
            typeof model.context_length === "number"
              ? model.context_length
              : null,
          supports_image_in:
            "supports_image_in" in model &&
            typeof model.supports_image_in === "boolean"
              ? model.supports_image_in
              : null,
          supports_video_in:
            "supports_video_in" in model &&
            typeof model.supports_video_in === "boolean"
              ? model.supports_video_in
              : null,
          supports_reasoning:
            "supports_reasoning" in model &&
            typeof model.supports_reasoning === "boolean"
              ? model.supports_reasoning
              : null,
        },
      });
    }

    return c.json(result);
  } catch (error) {
    console.error("Error fetching models:", error);
    return c.json({ error: "Unexpected error occurred" }, 500);
  }
});
