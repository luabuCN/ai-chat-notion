import type { UIMessage } from "ai";
import type { Suggestion } from "./queries";
import type { AppUsage } from "./usage";

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
};

export type MessageMetadata = {
  createdAt: string;
};

export type ChatMessage = UIMessage<
  MessageMetadata,
  CustomUIDataTypes,
  ChatTools
>;
