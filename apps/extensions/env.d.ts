/// <reference types="wxt/vite-builder-env" />

interface ImportMetaEnv {
  readonly WXT_WEB_ORIGIN?: string;
  /** 业务 API 基址（直连 server），与 WXT_WEB_ORIGIN 分离 */
  readonly WXT_API_ORIGIN?: string;
  /** 主站页面 URL match pattern，与 WXT_WEB_ORIGIN 同源 */
  readonly WXT_WEB_MATCH_PATTERN?: string;
}
