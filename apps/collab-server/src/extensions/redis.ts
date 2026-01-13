import { Redis as HocuspocusRedis } from "@hocuspocus/extension-redis";

export function getSafeRedisExtension() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.log("[Redis] Disabled or no REDIS_URL, single-instance mode");
    return null;
  }
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
}
