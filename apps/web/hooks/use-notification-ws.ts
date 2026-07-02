"use client";

import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { notificationKeys } from "./use-notifications";
import { workspaceKeys } from "@/components/workspace-provider";
import type { Workspace } from "@/components/workspace-switcher";
import { useServerWsBase } from "./use-server-ws-origin";

const MAX_RECONNECT_DELAY = 30_000;
const INITIAL_RECONNECT_DELAY = 1_000;

export function useNotificationWs(token: string | null) {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectDelayRef = useRef(INITIAL_RECONNECT_DELAY);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const pathname = usePathname();
  const router = useRouter();

  // Keep a ref to always have the latest pathname
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const wsBase = useServerWsBase();

  const connect = useCallback(() => {
    if (!token || !mountedRef.current) return;

    const ws = new WebSocket(`${wsBase}/ws/notifications?token=${token}`);
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
          const notification = data.notification;
          const currentPath = pathnameRef.current;

          queryClient.invalidateQueries({
            queryKey: notificationKeys.all,
          });

          if (!notification) return;

          const nType = notification.type;
          const payload = notification.payload as Record<string, unknown> | null;

          // 文档权限变更：在该文档页 → 刷新
          if (nType === "DOC_PERMISSION_CHANGED" && payload?.documentId) {
            const docId = payload.documentId as string;
            if (currentPath?.startsWith(`/editor/${docId}`)) {
              window.location.reload();
            }
          }

          // 文档移除：在该文档页 → 刷新页面
          if (nType === "DOC_REMOVED" && payload?.documentId) {
            const docId = payload.documentId as string;
            if (currentPath?.startsWith(`/editor/${docId}`)) {
              window.location.reload();
            }
          }

          // MENTION: cache invalidation above is sufficient;
          // navigation is handled by notification-item.tsx

          // 空间权限变更：在该空间 → refresh；不在 → 刷新空间列表
          if (nType === "SPACE_PERMISSION_CHANGED" && payload?.workspaceId) {
            if (currentPath?.startsWith(`/${payload.workspaceSlug ?? "__none__"}/`)) {
              router.refresh();
            } else {
              window.dispatchEvent(new CustomEvent("refresh-workspaces"));
            }
          }

          // 空间移除：立即从本地列表移除并刷新，WorkspaceProvider 负责跳转默认空间
          if (nType === "SPACE_REMOVED") {
            const removedWorkspaceId = payload?.workspaceId as string | undefined;
            const removedWorkspaceSlug = payload?.workspaceSlug as
              | string
              | undefined;

            queryClient.setQueryData<Workspace[]>(workspaceKeys.all, (prev) => {
              if (!prev) {
                return prev;
              }

              return prev.filter((workspace) => {
                if (removedWorkspaceId) {
                  return workspace.id !== removedWorkspaceId;
                }
                if (removedWorkspaceSlug) {
                  return workspace.slug !== removedWorkspaceSlug;
                }
                return true;
              });
            });

            void queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
            window.dispatchEvent(new CustomEvent("refresh-workspaces"));
          }
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
  }, [token, wsBase, queryClient, router]);

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
