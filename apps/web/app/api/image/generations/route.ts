import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { model, prompt, negative_prompt, size, seed, steps } = body;

    const apiKey =
      process.env.MODELSCOPE_API_KEY ||
      "ms-7ab75421-b457-4de3-8762-52d8d48bcb50";
    const baseUrl = "https://api-inference.modelscope.cn/";

    // 过滤掉 undefined 的可选参数，以免请求报错
    const requestBody: Record<string, any> = {
      model: model || "Tongyi-MAI/Z-Image-Turbo",
      prompt,
    };
    if (negative_prompt) requestBody.negative_prompt = negative_prompt;
    if (size) requestBody.size = size;
    if (seed) requestBody.seed = seed;
    if (steps) requestBody.steps = steps;

    const response = await fetch(`${baseUrl}v1/images/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-ModelScope-Async-Mode": "true",
      },
      body: JSON.stringify(requestBody),
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
    console.error("Error generating image:", error);
    return NextResponse.json(
      { error: "Failed to create image generation task" },
      { status: 500 }
    );
  }
}
