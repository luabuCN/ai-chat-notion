"use client";

import { useEffect, useState } from "react";
import { useNotificationWs } from "@/hooks/use-notification-ws";
import { apiFetch } from "@/lib/api-client";

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchToken() {
      try {
        const res = await apiFetch("/api/notifications/ws-token", {
          method: "POST",
        });
        if (res.ok && !cancelled) {
          const data = await res.json();
          setToken(data.token);
        }
      } catch {
        // Silently fail — WS will retry
      }
    }
    fetchToken();
    return () => { cancelled = true; };
  }, []);

  useNotificationWs(token);

  return <>{children}</>;
}
