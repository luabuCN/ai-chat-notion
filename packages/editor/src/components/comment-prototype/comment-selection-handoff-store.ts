import { create } from "zustand";
import type { CommentMarginCueGeom } from "./comment-margin-types";

type CommentSelectionHandoffState = {
  /** 气泡「评论」点选后固定在右侧的评论锚点，直至关闭面板 */
  handoffGeom: CommentMarginCueGeom | null;
  handoffPanelOpen: boolean;
  /**
   * 仅当 geom 携带有效 blockId 时才进入 handoff —— 没有 stable id 的旧块/
   * 瞬时态没法作为评论锚点，调用方应改为退化为普通 hover 流程。
   */
  startCommentFromBubbleSelection: (geom: CommentMarginCueGeom) => void;
  dismissHandoff: () => void;
};

export const useCommentSelectionHandoffStore =
  create<CommentSelectionHandoffState>((set) => ({
    handoffGeom: null,
    handoffPanelOpen: false,
    startCommentFromBubbleSelection: (geom) => {
      if (!geom.blockId) {
        return;
      }
      set({ handoffGeom: geom, handoffPanelOpen: true });
    },
    dismissHandoff: () =>
      set({ handoffGeom: null, handoffPanelOpen: false }),
  }));
