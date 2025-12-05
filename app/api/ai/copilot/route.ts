import type { NextRequest } from 'next/server';

import { generateText } from 'ai';
import { NextResponse } from 'next/server';

import { getProviderWithModel, getFirstModelSlug } from '@/lib/ai/providers';

export async function POST(req: NextRequest) {
  const {
    model,
    prompt,
    system,
  } = await req.json();

  // Use custom model if provided, otherwise use first available model
  const modelSlug = model || await getFirstModelSlug();
  const modelProvider = getProviderWithModel(modelSlug);

  try {
    const result = await generateText({
      abortSignal: req.signal,
      maxOutputTokens: 50,
      model: modelProvider,
      prompt,
      system,
      temperature: 0.7,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(null, { status: 408 });
    }

    return NextResponse.json(
      { error: 'Failed to process AI request' },
      { status: 500 }
    );
  }
}
