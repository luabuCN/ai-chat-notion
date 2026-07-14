import { useCallback, useRef } from "react";
import type { StatesArray } from "@hocuspocus/provider";

export interface CollaborativeUser {
  name: string;
  color: string;
  avatar?: string;
  email?: string;
}

export interface ExtractedUsers {
  users: CollaborativeUser[];
  signature: string;
}

/**
 * 从 awareness states 中提取并去重在线用户。
 *
 * 去重规则：以 `name|color` 为 key 合并；后到的条目若补充了 avatar / email
 * 则合并进既有记录（与原 unified-editor 内联逻辑完全一致）。
 *
 * 注意：Hocuspocus 的 `onAwarenessUpdate` 传入的 `states` 是数组
 * （`awarenessStatesToArray` 的产物），原代码用 `Array.from(states.values())`
 * 遍历——对数组而言 `.values()` 返回元素迭代器，行为等价于展开数组。
 */
export function extractCollaborativeUsers(
  states: StatesArray
): ExtractedUsers {
  const raw = Array.from(states.values())
    .filter(
      (state: Record<string, unknown>) =>
        state.user && (state.user as Record<string, unknown>).name
    )
    .map(
      (state: Record<string, unknown>) =>
        state.user as CollaborativeUser
    );

  const byKey = new Map<string, CollaborativeUser>();
  for (const u of raw) {
    const key = `${u.name}|${u.color}`;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, u);
      continue;
    }
    if (
      (!prev.avatar && typeof u.avatar === "string" && u.avatar) ||
      (!prev.email && typeof u.email === "string" && u.email)
    ) {
      byKey.set(key, {
        ...prev,
        ...(u.avatar && !prev.avatar ? { avatar: u.avatar } : {}),
        ...(u.email && !prev.email ? { email: u.email } : {}),
      });
    }
  }
  const users = Array.from(byKey.values());

  const signature = users
    .map(
      (u) =>
        `${u.name}|${u.color}|${
          typeof u.avatar === "string" ? u.avatar : ""
        }|${typeof u.email === "string" ? u.email : ""}`
    )
    .sort()
    .join(",");

  return { users, signature };
}

/**
 * 管理 awareness 在线用户列表。
 *
 * 返回稳定的 `handleAwarenessUpdate(states)`，供 Provider 的
 * `onAwarenessUpdate` 回调在 setTimeout + generation 校验后调用。
 * 内部用 `connectedUsersSigRef` 做签名去抖，仅在用户集合真正变化时
 * 才上抛 `onConnectedUsersChange`，与原内联实现行为一致。
 */
export function useCollaborationAwareness(
  onConnectedUsersChange?: (users: CollaborativeUser[]) => void
) {
  const onConnectedUsersChangeRef = useRef(onConnectedUsersChange);
  onConnectedUsersChangeRef.current = onConnectedUsersChange;

  const connectedUsersSigRef = useRef("");

  const handleAwarenessUpdate = useCallback((states: StatesArray) => {
    const { users, signature } = extractCollaborativeUsers(states);
    if (signature !== connectedUsersSigRef.current) {
      connectedUsersSigRef.current = signature;
      onConnectedUsersChangeRef.current?.(users);
    }
  }, []);

  const resetSignature = useCallback(() => {
    connectedUsersSigRef.current = "";
  }, []);

  return {
    handleAwarenessUpdate,
    connectedUsersSigRef,
    resetSignature,
  };
}
