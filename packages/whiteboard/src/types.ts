import type { Awareness } from "y-protocols/awareness";

export type WhiteboardScope =
  | { type: "document" }
  | { type: "block"; blockId: string };

export type WhiteboardSurfaceMode = "page" | "embed" | "fullscreen";

export type WhiteboardPointer = {
  x: number;
  y: number;
};

export type WhiteboardAwarenessState = {
  scope: string;
  pointer?: WhiteboardPointer;
  button?: "down" | "up";
  username?: string;
  color?: string;
};

export type WhiteboardCollabConfig = {
  serverUrl: string;
  token: string;
};

export type CollaborativeUser = {
  name: string;
  color: string;
  avatar?: string;
};

export type WhiteboardSurfaceProps = {
  ydoc: import("yjs").Doc;
  scope: WhiteboardScope;
  awareness?: Awareness | null;
  readonly?: boolean;
  mode?: WhiteboardSurfaceMode;
  height?: number;
  className?: string;
  onFullscreen?: () => void;
  /** 本地用户信息，用于协同光标显示名称与颜色 */
  localUser?: CollaborativeUser;
};

export type WhiteboardEditorProps = {
  documentId: string;
  ydoc?: import("yjs").Doc;
  awareness?: import("y-protocols/awareness").Awareness | null;
  readonly?: boolean;
  collabConfig?: WhiteboardCollabConfig | null;
  initialYjsStateB64?: string | null;
  user?: CollaborativeUser;
  onLocalYjsState?: (state: Uint8Array) => void;
  enableHttpPersistence?: boolean;
  onConnectedUsersChange?: (users: CollaborativeUser[]) => void;
  onConnectionStatusChange?: (
    status: "connecting" | "connected" | "disconnected" | "idle"
  ) => void;
  className?: string;
};
