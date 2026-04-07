/** 扩展进程间消息协议（与 background 中 onMessage 一一对应） */

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
}
