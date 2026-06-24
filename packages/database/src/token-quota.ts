export const DEFAULT_MONTHLY_TOKEN_LIMIT = 100_000;

export type TokenQuota = {
  limit: number;
  used: number;
  remaining: number;
  periodKey: string;
  periodEnd: string;
  inputTokens: number;
  outputTokens: number;
};

export function getCurrentPeriodKey(date = new Date()): string {
  return date.toISOString().slice(0, 7);
}

export function getPeriodEnd(periodKey: string): string {
  const [yearStr, monthStr] = periodKey.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  return new Date(Date.UTC(year, month, 1)).toISOString();
}

export function resolveMonthlyTokenLimit(): number {
  const fromEnv = Number(process.env.MONTHLY_TOKEN_LIMIT);
  if (Number.isFinite(fromEnv) && fromEnv > 0) {
    return fromEnv;
  }
  return DEFAULT_MONTHLY_TOKEN_LIMIT;
}
