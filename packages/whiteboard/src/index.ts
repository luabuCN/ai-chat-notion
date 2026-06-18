export {
  ELEMENTS_DOC_KEY,
  ASSETS_DOC_KEY,
  META_DOC_KEY,
  BLOCKS_MAP_KEY,
  WHITEBOARD_SYNC_ORIGIN,
} from "./constants";
export type {
  WhiteboardScope,
  WhiteboardSurfaceMode,
  WhiteboardSurfaceProps,
  WhiteboardEditorProps,
  WhiteboardCollabConfig,
  CollaborativeUser,
} from "./types";
export {
  getWhiteboardYScope,
  ensureBlockState,
  removeBlockState,
  elementsFromYMap,
  syncElementsToYMap,
} from "./yjs/scope";
export { WhiteboardSurface } from "./components/whiteboard-surface";
export { WhiteboardEditor } from "./components/whiteboard-editor";
export { WhiteboardPreview } from "./components/whiteboard-preview";
export { WhiteboardSkeleton } from "./components/whiteboard-skeleton";
export { WhiteboardFullscreenDialog } from "./components/whiteboard-fullscreen-dialog";
export { createWhiteboardDocFromBase64 } from "./utils/yjs-state";
