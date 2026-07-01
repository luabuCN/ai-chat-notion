import { Redis as IORedis } from "ioredis";

// ─── Cache key 前缀常量 ─────────────────────────────────────────────────────
// 统一前缀避免与 Hocuspocus / notification-redis 的 key 冲突
const PREFIX = "cache";

export const CACHE_KEYS = {
  /** 文档列表（侧边栏树）: cache:docs:list:{userId}:{paramsHash} */
  docsList: (userId: string, paramsHash: string) =>
    `${PREFIX}:docs:list:${userId}:${paramsHash}`,
  /** 文档列表前缀（用于按用户批量失效） */
  docsListPrefix: (userId: string) => `${PREFIX}:docs:list:${userId}:*`,
  /** 文档全部列表（搜索）: cache:docs:all:{userId} */
  docsAll: (userId: string) => `${PREFIX}:docs:all:${userId}`,
  /** 文档路径（面包屑）: cache:docs:path:{documentId} */
  docsPath: (documentId: string) => `${PREFIX}:docs:path:${documentId}`,
  /** 工作空间列表: cache:ws:list:{userId} */
  wsList: (userId: string) => `${PREFIX}:ws:list:${userId}`,
  /** 未读通知计数: cache:notif:unread:{userId} */
  notifUnread: (userId: string) => `${PREFIX}:notif:unread:${userId}`,
  /** Yjs 文档协同状态（二进制）: cache:yjs:state:{documentId} */
  yjsState: (documentId: string) => `${PREFIX}:yjs:state:${documentId}`,
} as const;

// ─── TTL 常量（秒） ──────────────────────────────────────────────────────────
export const CACHE_TTL = {
  docsList: 60, // 1 分钟
  docsAll: 60, // 1 分钟
  docsPath: 120, // 2 分钟
  wsList: 300, // 5 分钟
  notifUnread: 10, // 10 秒
  yjsState: 300, // 5 分钟——覆盖 Hocuspocus 30s 内存超时，文档卸载后仍可从 Redis 恢复
} as const;

// ─── Redis 客户端管理 ────────────────────────────────────────────────────────
let cacheClient: IORedis | null = null;
let enabled = false;

export function isCacheEnabled(): boolean {
  return enabled;
}

export async function initCacheRedis(): Promise<void> {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) {
    console.log("[CacheRedis] Disabled (no REDIS_URL)");
    return;
  }

  if (enabled) return;

  const client = new IORedis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => Math.min(times * 100, 1000),
    connectTimeout: 2000,
    lazyConnect: true,
    enableOfflineQueue: false,
  });

  client.on("error", (error: Error) => {
    console.error("[CacheRedis] Error:", error.message);
  });

  try {
    await client.connect();
    await client.ping();
    cacheClient = client;
    enabled = true;
    console.log("[CacheRedis] Cache enabled");
  } catch (error) {
    client.disconnect();
    console.error(
      `[CacheRedis] Connection failed: ${(error as Error).message}. Cache disabled.`
    );
  }
}

export async function closeCacheRedis(): Promise<void> {
  enabled = false;
  if (cacheClient) {
    await cacheClient.quit().catch(() => cacheClient?.disconnect());
    cacheClient = null;
  }
}

// ─── 缓存操作 ────────────────────────────────────────────────────────────────

/**
 * 从缓存读取 JSON 值。缓存未命中或出错时返回 null（fail-open，不阻塞请求）。
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!enabled || !cacheClient) return null;
  try {
    const raw = await cacheClient.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * 写入缓存（带 TTL，单位秒）。出错时静默忽略。
 */
export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number
): Promise<void> {
  if (!enabled || !cacheClient) return;
  try {
    await cacheClient.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch {
    // 缓存写入失败不影响业务逻辑
  }
}

/**
 * 从缓存读取二进制 Buffer（用于 Yjs state 等）。
 * 缓存未命中或出错时返回 null（fail-open，不阻塞请求）。
 */
export async function cacheGetBuffer(key: string): Promise<Buffer | null> {
  if (!enabled || !cacheClient) return null;
  try {
    const result = await cacheClient.getBuffer(key);
    return result ? Buffer.from(result) : null;
  } catch {
    return null;
  }
}

/**
 * 写入二进制 Buffer 缓存（带 TTL，单位秒）。出错时静默忽略。
 */
export async function cacheSetBuffer(
  key: string,
  value: Buffer,
  ttlSeconds: number
): Promise<void> {
  if (!enabled || !cacheClient) return;
  try {
    await cacheClient.set(key, value, "EX", ttlSeconds);
  } catch {
    // 缓存写入失败不影响业务逻辑
  }
}

/**
 * 删除指定 key。出错时静默忽略。
 */
export async function cacheDel(...keys: string[]): Promise<void> {
  if (!enabled || !cacheClient || keys.length === 0) return;
  try {
    await cacheClient.del(...keys);
  } catch {
    // 静默
  }
}

/**
 * 按模式批量删除缓存 key（使用 SCAN，不阻塞 Redis）。
 */
export async function cacheDelPattern(pattern: string): Promise<void> {
  if (!enabled || !cacheClient) return;
  try {
    let cursor = "0";
    do {
      const [next, batch] = await cacheClient.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        100
      );
      cursor = next;
      if (batch.length > 0) {
        await cacheClient.del(...batch);
      }
    } while (cursor !== "0");
  } catch {
    // 静默
  }
}

/**
 * 从查询参数生成 hash，用作缓存 key 的一部分。
 */
export function hashParams(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) return "root";
  return entries.map(([k, v]) => `${k}=${v}`).join("&");
}
