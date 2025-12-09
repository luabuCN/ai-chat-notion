import { NextRequest, NextResponse } from "next/server";

const UNSPLASH_ACCESS_KEY =
  "WhmMbg_TC32FaHGel-Lpc1sFMbfEOemNCCpMGDkjgcM";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("query") || "Scenery";
  const page = searchParams.get("page") || "1";
  const perPage = searchParams.get("per_page") || "10";

  try {
    const response = await fetch(
      `https://api.unsplash.com/search/photos?client_id=${UNSPLASH_ACCESS_KEY}&query=${query}&page=${page}&per_page=${perPage}`,
      {
        next: { revalidate: 3600 }, // 缓存1小时
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch from Unsplash");
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Unsplash API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch images" },
      { status: 500 }
    );
  }
}
