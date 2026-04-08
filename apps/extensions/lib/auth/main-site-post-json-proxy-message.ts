/** background → 主站 content：在页面内同源 POST JSON（Cookie 与主站标签一致） */
export const EXTENSION_MAIN_SITE_POST_JSON_PROXY_MESSAGE_TYPE =
  "WiseWrite:PROXY_MAIN_SITE_POST_JSON" as const;

export type ExtensionMainSitePostJsonProxyMessage = {
  type: typeof EXTENSION_MAIN_SITE_POST_JSON_PROXY_MESSAGE_TYPE;
  path: string;
  body: string;
};

export type MainSitePostJsonProxyResult = {
  ok: boolean;
  status: number;
  statusText: string;
  json: unknown;
};
