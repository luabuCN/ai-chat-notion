"use client";

import {
  resolveCollabWsUrl,
  resolveServerWsBase,
} from "@repo/editor/server-ws-origin";
import { useMemo } from "react";

/** 通知等 WebSocket 的基础地址（不含 path） */
export function useServerWsBase() {
  return useMemo(() => resolveServerWsBase(), []);
}

/** Hocuspocus 文档协同 WebSocket 地址 */
export function useCollabWsUrl() {
  return useMemo(() => resolveCollabWsUrl(), []);
}
