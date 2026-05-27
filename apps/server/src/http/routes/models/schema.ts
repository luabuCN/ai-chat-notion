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
