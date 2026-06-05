import { ChatSDKError } from "../errors.js";
import { prisma } from "../client.js";
import { Prisma, type NotificationType } from "@prisma/client";

// ==================== Notification Functions ====================

export async function getNotifications({
  userId,
  page = 1,
  pageSize = 20,
  type,
}: {
  userId: string;
  page?: number;
  pageSize?: number;
  type?: string | string[];
}) {
  try {
    const typeFilter = (() => {
      if (!type) return {};
      const types = Array.isArray(type) ? type : [type];
      if (types.length === 1) return { type: types[0] as NotificationType };
      return { type: { in: types as NotificationType[] } };
    })();

    const where = {
      receiverId: userId,
      ...typeFilter,
    };

    const [list, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        include: {
          sender: {
            select: { id: true, name: true, avatarUrl: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({
        where: { receiverId: userId, isRead: false },
      }),
    ]);

    return { list, total, unreadCount };
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get notifications"
    );
  }
}

export async function getUnreadCount({ userId }: { userId: string }) {
  try {
    return await prisma.notification.count({
      where: { receiverId: userId, isRead: false },
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get unread count"
    );
  }
}

export async function createNotification({
  receiverId,
  senderId,
  type,
  title,
  content,
  payload,
}: {
  receiverId: string;
  senderId?: string | null;
  type: NotificationType;
  title: string;
  content?: string | null;
  payload?: Prisma.InputJsonValue | null;
}) {
  try {
    return await prisma.notification.create({
      data: {
        receiverId,
        senderId: senderId ?? null,
        type,
        title,
        content: content ?? null,
        payload: payload ?? Prisma.DbNull,
      },
      include: {
        sender: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to create notification"
    );
  }
}

export async function markAsRead({
  notificationId,
  userId,
}: {
  notificationId: string;
  userId: string;
}) {
  try {
    return await prisma.notification.updateMany({
      where: {
        id: notificationId,
        receiverId: userId,
      },
      data: { isRead: true },
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to mark notification as read"
    );
  }
}

export async function markAllAsRead({ userId }: { userId: string }) {
  try {
    return await prisma.notification.updateMany({
      where: {
        receiverId: userId,
        isRead: false,
      },
      data: { isRead: true },
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to mark all notifications as read"
    );
  }
}

export async function deleteNotification({
  notificationId,
  userId,
}: {
  notificationId: string;
  userId: string;
}) {
  try {
    return await prisma.notification.deleteMany({
      where: {
        id: notificationId,
        receiverId: userId,
      },
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete notification"
    );
  }
}

export async function markNotificationActionTaken({
  notificationId,
  userId,
}: {
  notificationId: string;
  userId: string;
}) {
  try {
    const notification = await prisma.notification.findFirst({
      where: { id: notificationId, receiverId: userId },
    });
    if (!notification) return null;

    const payload = (notification.payload as Record<string, unknown>) ?? {};
    return await prisma.notification.update({
      where: { id: notificationId },
      data: {
        payload: { ...payload, actionTaken: true } as Prisma.InputJsonValue,
      },
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update notification action"
    );
  }
}
