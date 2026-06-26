import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

// Types
export interface NotificationUser {
  id: string;
  name: string | null;
  avatarUrl: string | null;
}

export interface Notification {
  id: string;
  receiverId: string;
  senderId: string | null;
  type: string;
  title: string;
  content: string | null;
  payload: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
  sender: NotificationUser | null;
}

export interface NotificationListResponse {
  list: Notification[];
  total: number;
  unreadCount: number;
}

// Query Keys
export const notificationKeys = {
  all: ["notifications"] as const,
  list: (params?: { page?: number; type?: string }) =>
    [...notificationKeys.all, "list", params] as const,
  unreadCount: () => [...notificationKeys.all, "unread-count"] as const,
};

// API Functions
async function fetchNotifications(params?: {
  page?: number;
  pageSize?: number;
  type?: string;
}): Promise<NotificationListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.append("page", String(params.page));
  if (params?.pageSize) searchParams.append("pageSize", String(params.pageSize));
  if (params?.type) searchParams.append("type", params.type);

  const response = await apiFetch(
    `/api/notifications?${searchParams.toString()}`
  );
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to fetch notifications");
  }
  return response.json();
}

async function fetchUnreadCount(): Promise<number> {
  const response = await apiFetch("/api/notifications/unread-count");
  if (!response.ok) {
    throw new Error("Failed to fetch unread count");
  }
  const data = await response.json();
  return data.count;
}

async function markNotificationAsRead(
  notificationId: string
): Promise<void> {
  const response = await apiFetch(
    `/api/notifications/${notificationId}/read`,
    { method: "PATCH" }
  );
  if (!response.ok) {
    throw new Error("Failed to mark notification as read");
  }
}

async function markAllNotificationsAsRead(): Promise<void> {
  const response = await apiFetch("/api/notifications/read-all", {
    method: "PATCH",
  });
  if (!response.ok) {
    throw new Error("Failed to mark all notifications as read");
  }
}

async function deleteNotificationById(
  notificationId: string
): Promise<void> {
  const response = await apiFetch(`/api/notifications/${notificationId}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error("Failed to delete notification");
  }
}

export type NotificationActionStatus = "accepted" | "rejected";

export interface MarkActionTakenParams {
  notificationId: string;
  status?: NotificationActionStatus;
  extraPayload?: Record<string, unknown>;
}

async function markNotificationActionTakenById(
  params: MarkActionTakenParams
): Promise<void> {
  const response = await apiFetch(
    `/api/notifications/${params.notificationId}/action`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: params.status ?? "accepted",
        extraPayload: params.extraPayload,
      }),
    }
  );
  if (!response.ok) {
    throw new Error("Failed to mark notification action taken");
  }
}

// Hooks
export function useNotifications(params?: {
  page?: number;
  type?: string;
}) {
  return useQuery({
    queryKey: notificationKeys.list(params),
    queryFn: () => fetchNotifications(params),
  });
}

export function useUnreadCount(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: fetchUnreadCount,
    refetchInterval: false,
    enabled: options?.enabled ?? true,
    retry: 2,
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markNotificationAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useMarkAllAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markAllNotificationsAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteNotificationById,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useMarkActionTaken() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markNotificationActionTakenById,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function getNotificationActionStatus(
  notification: Notification
): NotificationActionStatus | null {
  const payload = notification.payload;
  if (payload?.actionStatus === "accepted" || payload?.actionStatus === "rejected") {
    return payload.actionStatus;
  }
  if (payload?.actionTaken) {
    return "accepted";
  }
  return null;
}
