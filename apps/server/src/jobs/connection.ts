import { Redis as IORedis } from "ioredis";

export function getRedisUrl(): string | null {
  return process.env.REDIS_URL?.trim() || null;
}

export function isJobQueueEnabled(): boolean {
  return Boolean(getRedisUrl());
}

export function createBullConnection(): IORedis {
  const redisUrl = getRedisUrl();
  if (!redisUrl) {
    throw new Error("REDIS_URL is required for job queue");
  }

  return new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    connectTimeout: 5000,
  });
}
