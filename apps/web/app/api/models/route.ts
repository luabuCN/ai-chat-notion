// app/api/models/route.ts
import { NextResponse } from "next/server";

/* -------------------------
   类型定义
--------------------------*/

interface OpenRouterEndpoint {
  supported_parameters?: string[];
}

interface OpenRouterModel {
  slug: string;
  input_modalities?: string[];
  output_modalities?: string[];
  endpoint?: OpenRouterEndpoint;
}

export interface ModelInfo {
  provider: string;
  model: string;
  full_slug: string;
  input_modalities: string[];
  output_modalities: string[];
  supported_parameters: string[];
}

/* -------------------------
   GET Handler
--------------------------*/

export async function GET() {
  const url = "https://openrouter.ai/api/frontend/models/find?max_price=0";

  try {
    const response = await fetch(url, { cache: "no-store" });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch model list" },
        { status: 500 }
      );
    }

    const jsonData = await response.json();
    const models: OpenRouterModel[] = jsonData?.data?.models ?? [];

    const result: ModelInfo[] = models.map((m) => {
      const slug = m.slug;

      const [provider, nameWithSuffix] = slug.split("/");
      const model = nameWithSuffix.split(":")[0];

      return {
        provider,
        model,
        full_slug: slug,
        input_modalities: m.input_modalities ?? [],
        output_modalities: m.output_modalities ?? [],
        supported_parameters: m.endpoint?.supported_parameters ?? []
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching models:", error);
    return NextResponse.json(
      { error: "Unexpected error occurred" },
      { status: 500 }
    );
  }
}
