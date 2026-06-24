import type { InferUITool, UIMessage } from "ai";
import type { Suggestion } from "@repo/database";
import type { TokenQuota } from "@repo/database";
import type { createDocument } from "../http/ai/tools/create-document.js";
import type { getWeather } from "../http/ai/tools/get-weather.js";
import type { requestSuggestions } from "../http/ai/tools/request-suggestions.js";
import type { updateDocument } from "../http/ai/tools/update-document.js";
import type { viewDocument } from "../http/ai/tools/view-document.js";

export const artifactKinds = ["text", "code", "sheet"] as const;
export type ArtifactKind = (typeof artifactKinds)[number];

export type AppUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  reasoningTokens?: number;
  cachedInputTokens?: number;
};

export const messageMetadataSchema = {
  createdAt: "",
};

type WeatherTool = InferUITool<typeof getWeather>;
type ViewDocumentTool = InferUITool<typeof viewDocument>;
type CreateDocumentTool = InferUITool<ReturnType<typeof createDocument>>;
type UpdateDocumentTool = InferUITool<ReturnType<typeof updateDocument>>;
type RequestSuggestionsTool = InferUITool<ReturnType<typeof requestSuggestions>>;

export type ChatTools = {
  getWeather: WeatherTool;
  viewDocument: ViewDocumentTool;
  createDocument: CreateDocumentTool;
  updateDocument: UpdateDocumentTool;
  requestSuggestions: RequestSuggestionsTool;
};

export type CustomUIDataTypes = {
  textDelta: string;
  imageDelta: string;
  sheetDelta: string;
  codeDelta: string;
  suggestion: Suggestion;
  appendMessage: string;
  id: string;
  title: string;
  kind: ArtifactKind;
  clear: null;
  finish: null;
  usage: AppUsage;
  tokenQuota: TokenQuota;
};

export type ChatMessage = UIMessage<
  {
    createdAt: string;
    renderMode?: "markdown" | "openui";
    documentRefs?: Array<{ id: string; title: string; icon?: string | null }>;
  },
  CustomUIDataTypes,
  ChatTools
>;
