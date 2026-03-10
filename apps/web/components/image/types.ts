import type { ComponentType } from "react";

export type PromptOptions = {
  styles: string[];
  scenes: string[];
  lighting: string[];
  camera: string[];
  quality: string[];
  negatives: string[];
};

export type HistoryItem = {
  id: string;
  prompt: string;
  negativePrompt: string | null;
  model: string;
  size: string | null;
  aspectRatio: string | null;
  status: string;
  providerStatus: string | null;
  outputImageUrl: string | null;
  errorMessage: string | null;
  workspaceRole: string;
  workspacePermission: string | null;
  createdAt: string;
  workspace?: {
    id: string;
    name: string;
    slug: string;
  } | null;
};

export type PromptLibraryGroup = {
  key: keyof PromptOptions;
  title: string;
  icon: ComponentType<{ className?: string }>;
  items: string[];
};