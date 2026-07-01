import { Redis as IORedis } from "ioredis";

const NOTIFICATION_CHANNEL = "notifications:broadcast";

type BroadcastMessage = {
  userId: string;
  data: object;
};

let publisher: IORedis | null = null;
let subscriber: IORedis | null = null;
let enabled = false;

function createRedisClient(redisUrl: string): IORedis {
  return new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
    connectTimeout: 3000, // 3 秒连接超时，避免冷启动挂起
  });
}

export function isNotificationRedisEnabled(): boolean {
  return enabled;
}

export async function initNotificationBroadcastRedis(
  deliverLocally: (userId: string, data: object) => void
): Promise<void> {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) {
    console.log(
      "[NotificationRedis] Disabled (no REDIS_URL), single-instance mode"
    );
    return;
  }

  if (enabled) {
    return;
  }

  const pub = createRedisClient(redisUrl);
  const sub = createRedisClient(redisUrl);

  pub.on("error", (error: Error) => {
    console.error("[NotificationRedis] Publisher error:", error.message);
  });
  sub.on("error", (error: Error) => {
    console.error("[NotificationRedis] Subscriber error:", error.message);
  });

  try {
    await Promise.all([pub.connect(), sub.connect()]);
    await Promise.all([pub.ping(), sub.ping()]);

    sub.on("message", (_channel: string, message: string) => {
      try {
        const payload = JSON.parse(message) as BroadcastMessage;
        if (!payload.userId || !payload.data) {
          return;
        }
        deliverLocally(payload.userId, payload.data);
      } catch {
        // ignore malformed pub/sub payloads
      }
    });

    await sub.subscribe(NOTIFICATION_CHANNEL);

    publisher = pub;
    subscriber = sub;
    enabled = true;
    console.log(
      "[NotificationRedis] Pub/sub enabled for multi-instance notifications"
    );
  } catch (error) {
    pub.disconnect();
    sub.disconnect();
    console.error(
      `[NotificationRedis] Connection failed: ${(error as Error).message}. Using single-instance mode.`
    );
  }
}

export function publishNotificationBroadcast(
  userId: string,
  data: object
): void {
  if (!enabled || !publisher) {
    return;
  }

  const payload: BroadcastMessage = { userId, data };
  void publisher
    .publish(NOTIFICATION_CHANNEL, JSON.stringify(payload))
    .catch((error: Error) => {
      console.error("[NotificationRedis] Publish failed:", error.message);
    });
}

export async function closeNotificationBroadcastRedis(): Promise<void> {
  enabled = false;

  const closing: Promise<unknown>[] = [];
  if (subscriber) {
    closing.push(subscriber.quit().catch(() => subscriber?.disconnect()));
    subscriber = null;
  }
  if (publisher) {
    closing.push(publisher.quit().catch(() => publisher?.disconnect()));
    publisher = null;
  }

  await Promise.all(closing);
}
