import { useCallback, useEffect, useState } from "react";

export type ActiveTabPageInfo = {
  /** 是否可在当前页面向内容脚本请求 DOM 类能力（如 Readability） */
  canExtractReadableContent: boolean;
  favIconUrl: string | undefined;
  title: string;
  tabId?: number;
  url?: string;
};

/** 无标签页数据时用于纯 UI 占位（不请求后端） */
export const ACTIVE_TAB_PAGE_PLACEHOLDER: ActiveTabPageInfo = {
  canExtractReadableContent: false,
  favIconUrl: undefined,
  title: "打开网页后，将显示当前页面标题",
};

function isRestrictedUrl(url: string | undefined): boolean {
  if (!url) {
    return true;
  }
  return (
    url.startsWith("chrome://") ||
    url.startsWith("chrome-extension://") ||
    url.startsWith("edge://") ||
    url.startsWith("about:") ||
    url.startsWith("devtools://")
  );
}

/**
 * 当前浏览器窗口中选中的标签页标题与 favicon，供侧栏「总结网站」等能力使用。
 */
export function useActiveTabPageInfo() {
  const [info, setInfo] = useState<ActiveTabPageInfo | null>(null);

  const refresh = useCallback(async () => {
    try {
      const tabs = await browser.tabs.query({
        active: true,
        lastFocusedWindow: true,
      });
      const tab = tabs[0];
      if (!tab) {
        setInfo(null);
        return;
      }
      const title = tab.title?.trim() || "无标题";
      const tabId = tab.id;
      const url = tab.url;
      if (isRestrictedUrl(url)) {
        setInfo({
          canExtractReadableContent: false,
          favIconUrl: undefined,
          tabId,
          title,
          url,
        });
        return;
      }
      setInfo({
        canExtractReadableContent: tabId !== undefined,
        favIconUrl: tab.favIconUrl,
        tabId,
        title,
        url,
      });
    } catch {
      setInfo(null);
    }
  }, []);

  useEffect(() => {
    void refresh();

    const onActivated = () => {
      void refresh();
    };

    const onUpdated = (
      _tabId: number,
      changeInfo: {
        favIconUrl?: string;
        status?: string;
        title?: string;
      },
    ) => {
      if (
        changeInfo.status === "complete" ||
        changeInfo.title !== undefined ||
        changeInfo.favIconUrl !== undefined
      ) {
        void refresh();
      }
    };

    const onFocusChanged = (_windowId: number) => {
      void refresh();
    };

    browser.tabs.onActivated.addListener(onActivated);
    browser.tabs.onUpdated.addListener(onUpdated);
    browser.windows.onFocusChanged.addListener(onFocusChanged);

    return () => {
      browser.tabs.onActivated.removeListener(onActivated);
      browser.tabs.onUpdated.removeListener(onUpdated);
      browser.windows.onFocusChanged.removeListener(onFocusChanged);
    };
  }, [refresh]);

  return { info };
}
