import { storage } from "#imports";

export const extensionWorkspaceSlugStorage = storage.defineItem<string | null>(
  "local:extensionWorkspaceSlug",
  { defaultValue: null },
);
