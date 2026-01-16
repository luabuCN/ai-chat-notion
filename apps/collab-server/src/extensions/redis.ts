import { Redis as HocuspocusRedis } from "@hocuspocus/extension-redis";
import Redis from "ioredis";

export async function getSafeRedisExtension() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.log("[Redis] Disabled or no REDIS_URL, single-instance mode");
    return null;
  }

  // Test connection first
  const tempRedis = new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
    retryStrategy: () => null, // Don't retry
    connectTimeout: 2000, // 2s timeout
  });

  try {
    await tempRedis.ping();
    await tempRedis.quit();

    // Connection successful, create the actual extension
    const url = new URL(redisUrl);
    return new HocuspocusRedis({
      host: url.hostname,
      port: Number(url.port) || 6379,
      options: {
        username: url.username,
        password: url.password,
      },
      prefix: "hocuspocus",
    });
  } catch (error) {
    tempRedis.disconnect();
    console.error(
      `[Redis] Connection failed: ${
        (error as Error).message
      }. Using single-instance mode.`
    );
    return null;
  }
}
