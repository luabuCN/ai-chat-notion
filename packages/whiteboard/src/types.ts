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
  /** 与全局主题同步：light | dark */
  theme?: "light" | "dark";
  /** Excalidraw 语言，如 zh-CN、en */
  langCode?: string;
  /**
   * 是否允许本地修改回写 Yjs。协同模式下需等待 provider 同步完成后再置 true，
   * 否则同步前挂载的空画布会清空共享内容。默认 true。
   */
  localSyncReady?: boolean;
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
  onPermissionRevoked?: () => void;
  /** Bump to recreate the collab provider (e.g. after permission downgrade). */
  collabSessionKey?: number;
  className?: string;
  theme?: "light" | "dark";
  langCode?: string;
};
