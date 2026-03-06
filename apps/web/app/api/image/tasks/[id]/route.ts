import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const apiKey =
      process.env.MODELSCOPE_API_KEY ||
      "ms-7ab75421-b457-4de3-8762-52d8d48bcb50";
    const baseUrl = "https://api-inference.modelscope.cn/";

    const response = await fetch(`${baseUrl}v1/tasks/${id}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-ModelScope-Task-Type": "image_generation",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching task status:", error);
    return NextResponse.json(
      { error: "Failed to fetch task status" },
      { status: 500 }
    );
  }
}
