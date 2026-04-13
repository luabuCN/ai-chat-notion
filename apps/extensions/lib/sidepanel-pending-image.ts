/** 与 `browser.storage.session` 键一致，供 background 写入与侧栏读取 */
export const SIDEPANEL_PENDING_IMAGE_KEY = "sidepanelPendingImage";

export type SidepanelPendingImageAttachment = {
  url: string;
  name: string;
  mediaType: "image/jpeg" | "image/png";
};

export type SidepanelPendingImagePayload =
  | {
      attachment: SidepanelPendingImageAttachment;
      mode: "chat" | "extract";
    }
  | { error: string };
