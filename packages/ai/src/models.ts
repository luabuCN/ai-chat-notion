export const DEFAULT_CHAT_MODEL: string = "moonshot-v1-8k";

export type ChatModel = {
  id: string;
  name: string;
  description: string;
};

export const chatModels: ChatModel[] = [];
