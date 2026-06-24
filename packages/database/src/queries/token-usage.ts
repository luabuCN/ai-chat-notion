import { prisma } from "../client.js";
import {
  getCurrentPeriodKey,
  getPeriodEnd,
  resolveMonthlyTokenLimit,
  type TokenQuota,
} from "../token-quota.js";

export type { TokenQuota };

function buildTokenQuota({
  limit,
  periodKey,
  totalTokens,
  inputTokens,
  outputTokens,
}: {
  limit: number;
  periodKey: string;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
}): TokenQuota {
  const used = totalTokens;
  return {
    limit,
    used,
    remaining: Math.max(0, limit - used),
    periodKey,
    periodEnd: getPeriodEnd(periodKey),
    inputTokens,
    outputTokens,
  };
}

export async function getUserTokenQuota({
  userId,
  limit = resolveMonthlyTokenLimit(),
}: {
  userId: string;
  limit?: number;
}): Promise<TokenQuota> {
  const periodKey = getCurrentPeriodKey();
  const record = await prisma.userMonthlyTokenUsage.findUnique({
    where: {
      userId_periodKey: {
        userId,
        periodKey,
      },
    },
  });

  return buildTokenQuota({
    limit,
    periodKey,
    totalTokens: record?.totalTokens ?? 0,
    inputTokens: record?.inputTokens ?? 0,
    outputTokens: record?.outputTokens ?? 0,
  });
}

export async function incrementUserMonthlyTokenUsage({
  userId,
  delta,
  limit = resolveMonthlyTokenLimit(),
}: {
  userId: string;
  delta: { total: number; input: number; output: number };
  limit?: number;
}): Promise<TokenQuota> {
  const periodKey = getCurrentPeriodKey();

  await prisma.userMonthlyTokenUsage.upsert({
    where: {
      userId_periodKey: {
        userId,
        periodKey,
      },
    },
    create: {
      userId,
      periodKey,
      totalTokens: delta.total,
      inputTokens: delta.input,
      outputTokens: delta.output,
    },
    update: {
      totalTokens: { increment: delta.total },
      inputTokens: { increment: delta.input },
      outputTokens: { increment: delta.output },
    },
  });

  return getUserTokenQuota({ userId, limit });
}
