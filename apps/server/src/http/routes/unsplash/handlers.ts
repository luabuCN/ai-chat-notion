import type { Context } from "hono";

const UNSPLASH_ACCESS_KEY =
  "WhmMbg_TC32FaHGel-Lpc1sFMbfEOemNCCpMGDkjgcM";

export async function searchUnsplashHandler(c: Context) {
  const searchParams = new URL(c.req.url).searchParams;
  const query = searchParams.get("query") || "Scenery";
  const page = searchParams.get("page") || "1";
  const perPage = searchParams.get("per_page") || "10";

  try {
    const response = await fetch(
      `https://api.unsplash.com/search/photos?client_id=${UNSPLASH_ACCESS_KEY}&query=${query}&page=${page}&per_page=${perPage}`
    );

    if (!response.ok) {
      throw new Error("Failed to fetch from Unsplash");
    }

    const data = await response.json();
    return c.json(data);
  } catch (error) {
    console.error("Unsplash API error:", error);
    return c.json({ error: "Failed to fetch images" }, 500);
  }
}
