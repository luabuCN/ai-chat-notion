import { create } from "zustand";
import type { CommentMarginCueGeom } from "./comment-margin-types";

type CommentSelectionHandoffState = {
  /** 气泡「评论」点选后固定在右侧的评论锚点，直至关闭面板 */
  handoffGeom: CommentMarginCueGeom | null;
  handoffPanelOpen: boolean;
  startCommentFromBubbleSelection: (geom: CommentMarginCueGeom) => void;
  dismissHandoff: () => void;
};

export const useCommentSelectionHandoffStore =
  create<CommentSelectionHandoffState>((set) => ({
    handoffGeom: null,
    handoffPanelOpen: false,
    startCommentFromBubbleSelection: (geom) => {
      set({ handoffGeom: geom, handoffPanelOpen: true });
    },
    dismissHandoff: () =>
      set({ handoffGeom: null, handoffPanelOpen: false }),
  }));
