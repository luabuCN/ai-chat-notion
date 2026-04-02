export const EXTENSION_MAIN_SITE_API_PROXY_MESSAGE_TYPE =
  "WiseWrite:PROXY_MAIN_SITE_API" as const;

export type ExtensionMainSiteApiProxyMessage = {
  type: typeof EXTENSION_MAIN_SITE_API_PROXY_MESSAGE_TYPE;
  path: string;
  method: "GET" | "DELETE";
};

export type MainSiteApiProxyResult = {
  ok: boolean;
  status: number;
  statusText: string;
  json: unknown;
};
