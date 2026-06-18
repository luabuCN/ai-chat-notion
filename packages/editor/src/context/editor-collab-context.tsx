"use client";

import type { HocuspocusProvider } from "@hocuspocus/provider";
import { createContext, useContext } from "react";
import type * as Y from "yjs";

export type EditorCollabContextValue = {
  ydoc: Y.Doc;
  awareness: HocuspocusProvider["awareness"] | null;
  readonly: boolean;
};

export const EditorCollabContext = createContext<EditorCollabContextValue | null>(
  null
);

export function useEditorCollab(): EditorCollabContextValue | null {
  return useContext(EditorCollabContext);
}
