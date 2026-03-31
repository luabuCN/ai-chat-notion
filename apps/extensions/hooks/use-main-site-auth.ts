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

export function useMainSiteAuth() {
  const [auth, setAuth] = useState<MainSiteAuthState>({
    loading: true,
    data: null,
  });

  const load = useCallback(async () => {
    setAuth((s) => ({ ...s, loading: true }));
    const data = await getAuthStatus();
    setAuth({ loading: false, data });
  }, []);

  const refresh = useCallback(async () => {
    setAuth((s) => ({ ...s, loading: true }));
    const data = await refreshAuthStatus();
    setAuth({ loading: false, data });
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

  return { auth, refresh };
}
