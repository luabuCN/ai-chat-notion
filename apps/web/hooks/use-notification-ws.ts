"use client";

import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { notificationKeys } from "./use-notifications";

const MAX_RECONNECT_DELAY = 30_000;
const INITIAL_RECONNECT_DELAY = 1_000;

export function useNotificationWs(token: string | null) {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectDelayRef = useRef(INITIAL_RECONNECT_DELAY);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!token || !mountedRef.current) return;

    const wsOrigin =
      process.env.NEXT_PUBLIC_WS_ORIGIN ||
      process.env.NEXT_PUBLIC_API_ORIGIN?.replace(/^http/, "ws") ||
      "ws://localhost:4000";

    const ws = new WebSocket(`${wsOrigin}/ws/notifications?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectDelayRef.current = INITIAL_RECONNECT_DELAY;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "ping") {
          ws.send(JSON.stringify({ type: "pong" }));
          return;
        }
        if (data.type === "new_notification") {
          queryClient.invalidateQueries({
            queryKey: notificationKeys.all,
          });
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      // Exponential backoff reconnect
      reconnectTimerRef.current = setTimeout(() => {
        reconnectDelayRef.current = Math.min(
          reconnectDelayRef.current * 2,
          MAX_RECONNECT_DELAY
        );
        connect();
      }, reconnectDelayRef.current);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [token, queryClient]);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);
}
