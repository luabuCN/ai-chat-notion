"use client";

import { useRef, useState } from "react";
import type { TokenQuota } from "@repo/database";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  Progress,
  Separator,
} from "@repo/ui";
import { cn } from "@/lib/utils";

const PERCENT_MAX = 100;
const WARNING_THRESHOLD = 80;
const CRITICAL_THRESHOLD = 95;
const HOVER_CLOSE_DELAY_MS = 120;

const RING_VIEWBOX = 24;
const RING_CENTER = 12;
const RING_RADIUS = 9;
const RING_STROKE_WIDTH = 2.5;
const RING_SIZE = 20;

function formatResetDate(periodEnd: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(periodEnd));
}

function InfoRow({
  label,
  tokens,
}: {
  label: string;
  tokens: number;
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{tokens.toLocaleString()}</span>
    </div>
  );
}

function TokenQuotaDetails({ quota }: { quota: TokenQuota }) {
  const usedPercent = Math.min(
    PERCENT_MAX,
    (quota.used / quota.limit) * PERCENT_MAX
  );

  return (
    <div className="min-w-[240px] space-y-2">
      <div className="space-y-1">
        <p className="font-medium text-sm">Monthly token usage</p>
        <p className="text-muted-foreground text-xs">
          Resets {formatResetDate(quota.periodEnd)} (UTC)
        </p>
      </div>
      <div className="flex items-start justify-between text-sm">
        <span>{usedPercent.toFixed(1)}%</span>
        <span className="text-muted-foreground">
          {quota.used.toLocaleString()} / {quota.limit.toLocaleString()}
        </span>
      </div>
      <Progress className="h-2 bg-muted" value={usedPercent} />
      <p className="text-muted-foreground text-xs">
        {quota.remaining.toLocaleString()} tokens remaining
      </p>
      <Separator />
      <div className="space-y-1">
        <InfoRow label="Input" tokens={quota.inputTokens} />
        <InfoRow label="Output" tokens={quota.outputTokens} />
      </div>
    </div>
  );
}

function getUsedArcClassName(usedPercent: number): string {
  if (usedPercent >= CRITICAL_THRESHOLD) {
    return "text-destructive";
  }
  if (usedPercent >= WARNING_THRESHOLD) {
    return "text-amber-500";
  }
  return "text-primary";
}

function QuotaRingIcon({
  usedPercent,
  toneClassName,
}: {
  usedPercent: number;
  toneClassName: string;
}) {
  const radius = RING_RADIUS;
  const circumference = 2 * Math.PI * radius;
  const clampedUsed = Math.min(PERCENT_MAX, Math.max(0, usedPercent));
  const displayUsed =
    clampedUsed > 0 ? Math.max(clampedUsed, 2) : 0;
  const dashOffset = circumference * (1 - displayUsed / PERCENT_MAX);

  return (
    <svg
      aria-hidden="true"
      height={RING_SIZE}
      viewBox={`0 0 ${RING_VIEWBOX} ${RING_VIEWBOX}`}
      width={RING_SIZE}
    >
      <circle
        className="text-muted-foreground/35"
        cx={RING_CENTER}
        cy={RING_CENTER}
        fill="none"
        r={radius}
        stroke="currentColor"
        strokeWidth={RING_STROKE_WIDTH}
      />
      {displayUsed > 0 ? (
        <circle
          className={toneClassName}
          cx={RING_CENTER}
          cy={RING_CENTER}
          fill="none"
          r={radius}
          stroke="currentColor"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          strokeWidth={RING_STROKE_WIDTH}
          transform={`rotate(-90 ${RING_CENTER} ${RING_CENTER})`}
        />
      ) : null}
    </svg>
  );
}

function QuotaRingSkeleton() {
  return (
    <span
      aria-hidden="true"
      className="inline-flex size-8 animate-pulse items-center justify-center"
    >
      <QuotaRingIcon toneClassName="text-primary" usedPercent={0} />
    </span>
  );
}

export function TokenQuotaIndicator({
  quota,
  isLoading,
}: {
  quota?: TokenQuota;
  isLoading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCloseTimer = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const scheduleClose = () => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setOpen(false);
    }, HOVER_CLOSE_DELAY_MS);
  };

  if (isLoading || !quota) {
    return <QuotaRingSkeleton />;
  }

  const usedPercent = Math.min(
    PERCENT_MAX,
    (quota.used / quota.limit) * PERCENT_MAX
  );
  const toneClassName = getUsedArcClassName(usedPercent);
  const isExceeded = quota.remaining <= 0;

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <button
          aria-label={`${usedPercent.toFixed(1)}% of monthly tokens used. ${quota.remaining.toLocaleString()} remaining.`}
          className={cn(
            "inline-flex size-8 items-center justify-center rounded-md outline-none",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          )}
          onClick={() => {
            clearCloseTimer();
            setOpen((current) => !current);
          }}
          onMouseEnter={() => {
            clearCloseTimer();
            setOpen(true);
          }}
          onMouseLeave={scheduleClose}
          type="button"
        >
          <QuotaRingIcon
            toneClassName={isExceeded ? "text-destructive" : toneClassName}
            usedPercent={isExceeded ? PERCENT_MAX : usedPercent}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-fit p-3"
        onMouseEnter={clearCloseTimer}
        onMouseLeave={scheduleClose}
        side="top"
      >
        <TokenQuotaDetails quota={quota} />
      </PopoverContent>
    </Popover>
  );
}
