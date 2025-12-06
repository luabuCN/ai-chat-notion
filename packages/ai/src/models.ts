export const DEFAULT_CHAT_MODEL: string = "openai/gpt-oss-20b:free";

export type ChatModel = {
  id: string;
  name: string;
  description: string;
};

export const chatModels: ChatModel[] = [];
