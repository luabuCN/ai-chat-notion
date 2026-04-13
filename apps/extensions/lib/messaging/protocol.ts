/** 扩展进程间消息协议（与 background 中 onMessage 一一对应） */

import type { MainSitePostJsonProxyResult } from "@/lib/auth/main-site-post-json-proxy-message";

export type AuthStatusPayload = {
  authenticated: boolean;
  user: {
    id?: string;
    email?: string | null;
    name?: string | null;
    avatarUrl?: string | null;
  } | null;
};

export interface ExtensionProtocolMap {
  /** 读本地缓存（若有）否则 Cookie 请求 API，不依赖主站标签页 */
  getAuthStatus(): AuthStatusPayload;
  /** 强制请求 API 并更新缓存 */
  refreshAuthStatus(): AuthStatusPayload;
  /** 在后台创建标签页（内容脚本无 `tabs` API，须由此打开主站登录等） */
  openMainSiteLogin(): void;
  /**
   * 由 background 发起主站 POST JSON（直连 Cookie + 可选标签页回退）。
   * 供 content script 等无 `tabs` API 的上下文使用。
   */
  postMainSiteJson(data: { path: string; body: string }): MainSitePostJsonProxyResult;
  /**
   * 划词浮层「继续聊天」：打开侧栏并写入首轮问答（经 session storage 由侧栏消费）。
   */
  openSidePanelWithSeedChat(data: {
    selectedText: string;
    userQuery: string;
    assistantAnswer: string;
  }): { ok: true } | { ok: false; error: string };
  /**
   * 截取当前窗口可见区域，在页面内自由裁剪后返回 PNG data URL。
   */
  pageCapture(): Promise<
    | { ok: true; dataUrl: string }
    | { ok: false; cancelled: true }
    | { ok: false; error: string }
  >;
  /**
   * 页面图片工具栏：先打开侧栏，再上传图片并写入 session，供侧栏挂载为待发送附件。
   */
  openSidePanelWithImageDataUrl(data: {
    dataUrl: string;
    mode: "chat" | "extract";
  }): Promise<{ ok: true } | { ok: false; error: string }>;
  /**
   * 由 background 拉取图片并转为 data URL（扩展 host 权限，不受页面 CORS 限制）。
   * 仅允许 http(s)；可选 Referer 以兼容部分 CDN 防盗链。
   */
  fetchImageUrlAsDataUrl(data: {
    url: string;
    referrer?: string;
  }): Promise<{ dataUrl: string } | { error: string }>;
}
