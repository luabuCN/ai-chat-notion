import type { UIMessage } from "ai";
import type { Suggestion } from "./queries.js";
import type { AppUsage } from "./usage.js";
import type { TokenQuota } from "./token-quota.js";

export type ArtifactKind = "text" | "code" | "image" | "sheet";

export type ChatTools = any;

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

export type MessageMetadata = {
  createdAt: string;
  renderMode?: "markdown" | "openui";
};

export type ChatMessage = UIMessage<
  MessageMetadata,
  CustomUIDataTypes,
  ChatTools
>;
