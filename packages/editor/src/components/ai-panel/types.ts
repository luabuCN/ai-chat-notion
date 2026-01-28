import { PRESET_CONFIGS } from "./util";

export type CommandType = "preset" | "custom";

// Ensure this matches the keys in PRESET_CONFIGS
export type PresetType = keyof typeof PRESET_CONFIGS;

export interface AICommand {
  type: CommandType;
  preset?: PresetType;
  content: string;
  instruction?: string;
  options?: {
    contextBefore?: string;
    contextAfter?: string;
    contextLength?: number;
  };
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIStreamRequest {
  messages: ChatMessage[];
  options?: any;
  workspaceId?: string;
  modelId?: string | null;
}
