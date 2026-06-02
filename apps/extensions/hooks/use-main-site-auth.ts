import { useCallback, useEffect, useRef, useState } from "react";
import {
  getAuthStatus,
  refreshAuthStatus,
  type AuthStatusPayload,
} from "@/lib/auth/client";
import { mainSiteAuthStorage } from "@/lib/storage/main-site-auth";

export type MainSiteAuthState = {
  loading: boolean;
  data: AuthStatusPayload | null;
};

const LOGGED_OUT_PAYLOAD: AuthStatusPayload = {
  authenticated: false,
  user: null,
};

/** 未登录时的兜底轮询（主站登录事件 + storage.watch 已覆盖常见路径） */
const LOGGED_OUT_POLL_MS = 60_000;
/** focus / visibility 触发的刷新防抖 */
const REFRESH_DEBOUNCE_MS = 2_000;

export function useMainSiteAuth() {
  const [auth, setAuth] = useState<MainSiteAuthState>({
    loading: true,
    data: null,
  });
  const lastRefreshAtRef = useRef(0);

  const load = useCallback(async () => {
    setAuth((s) => ({ ...s, loading: true }));
    try {
      const data = await getAuthStatus();
      setAuth({ loading: false, data });
    } catch {
      // 首次获取失败时也要结束 loading，避免侧栏一直停留在“同步中”。
      setAuth({ loading: false, data: LOGGED_OUT_PAYLOAD });
    }
  }, []);

  const refresh = useCallback(async () => {
    setAuth((s) => ({ ...s, loading: true }));
    try {
      const data = await refreshAuthStatus();
      setAuth({ loading: false, data });
    } catch {
      setAuth((s) => ({ ...s, loading: false }));
    }
  }, []);

  const refreshSilently = useCallback(async () => {
    const now = Date.now();
    if (now - lastRefreshAtRef.current < REFRESH_DEBOUNCE_MS) {
      return;
    }
    lastRefreshAtRef.current = now;
    try {
      const data = await refreshAuthStatus();
      setAuth((s) => ({ ...s, loading: false, data }));
    } catch {
      setAuth((s) => ({ ...s, loading: false }));
    }
  }, []);

  useEffect(() => {
    const unwatch = mainSiteAuthStorage.watch((newVal) => {
      if (newVal !== null) {
        setAuth((s) => ({ ...s, loading: false, data: newVal.payload }));
      }
    });
    void load();
    return () => {
      void unwatch();
    };
  }, [load]);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void refreshSilently();
      }
    };

    const refreshOnFocus = () => {
      void refreshSilently();
    };

    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refreshSilently]);

  useEffect(() => {
    if (auth.loading || auth.data?.authenticated) {
      return;
    }

    const id = window.setInterval(() => {
      void refreshSilently();
    }, LOGGED_OUT_POLL_MS);

    return () => {
      window.clearInterval(id);
    };
  }, [auth.loading, auth.data?.authenticated, refreshSilently]);

  return { auth, refresh };
}
