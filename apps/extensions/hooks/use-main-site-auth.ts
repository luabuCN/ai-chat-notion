import { useCallback, useEffect, useState } from "react";
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

export function useMainSiteAuth() {
  const [auth, setAuth] = useState<MainSiteAuthState>({
    loading: true,
    data: null,
  });

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
    if (auth.data?.authenticated) {
      return;
    }

    const id = window.setInterval(() => {
      void refreshSilently();
    }, 4000);

    return () => {
      window.clearInterval(id);
    };
  }, [auth.data?.authenticated, refreshSilently]);

  return { auth, refresh };
}
