"use client";

import { cn } from "@repo/ui";
import { Maximize2 } from "lucide-react";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Awareness } from "y-protocols/awareness";
import { WhiteboardSkeleton } from "./whiteboard-skeleton";
import type { WhiteboardScope, WhiteboardSurfaceProps } from "../types";
import { useExcalidrawYjsBinding } from "../hooks/use-excalidraw-yjs-binding";
import { useWhiteboardAwareness } from "../hooks/use-whiteboard-awareness";
import { WhiteboardFullscreenDialog } from "./whiteboard-fullscreen-dialog";

const LazyExcalidraw = lazy(async () => {
  await import("@excalidraw/excalidraw/index.css");
  const mod = await import("@excalidraw/excalidraw");
  return { default: mod.Excalidraw };
});

function scopeKey(scope: WhiteboardScope): string {
  return scope.type === "document" ? "document" : scope.blockId;
}

type InnerProps = WhiteboardSurfaceProps & {
  mountCanvas: boolean;
};

function WhiteboardSurfaceInner({
  ydoc,
  scope,
  awareness,
  readonly = false,
  mode = "page",
  height = mode === "embed" ? 360 : undefined,
  className,
  onFullscreen,
  localUser,
  mountCanvas,
}: InnerProps) {
  const [api, setApi] = useState<
    import("@excalidraw/excalidraw/types").ExcalidrawImperativeAPI | null
  >(null);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const scopeKeyValue = scopeKey(scope);
  const { onChange } = useExcalidrawYjsBinding(ydoc, scope, api, readonly);
  const remotePointers = useWhiteboardAwareness(awareness ?? null, scopeKeyValue);

  const handleChange = useCallback(
    (
      elements: readonly Record<string, unknown>[],
      _appState: unknown,
      files: Record<string, Record<string, unknown>>
    ) => {
      onChange({ elements, files });
    },
    [onChange]
  );

  const handlePointerUpdate = useCallback(
    (payload: {
      pointer: { x: number; y: number };
      button: "down" | "up";
    }) => {
      if (!awareness || readonly) {
        return;
      }
      awareness.setLocalStateField("whiteboard", {
        scope: scopeKeyValue,
        pointer: payload.pointer,
        button: payload.button,
        username: localUser?.name,
        color: localUser?.color,
      });
    },
    [awareness, localUser?.color, localUser?.name, readonly, scopeKeyValue]
  );

  const containerHeight = height ?? (mode === "page" ? "calc(100dvh - 3rem)" : 360);

  const excalidrawUiOptions = useMemo(
    () =>
      mode === "embed"
        ? {
            canvasActions: {
              toggleTheme: false,
              export: false as const,
              saveAsImage: false,
              loadScene: false,
              saveToActiveFile: false,
            },
          }
        : undefined,
    [mode]
  );

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-lg border border-border bg-background",
        mode === "page" && "h-full min-h-0 border-0 rounded-none",
        className
      )}
      style={mode !== "page" ? { height: containerHeight } : undefined}
    >
      {mode === "embed" && !readonly ? (
        <div className="absolute right-2 top-2 z-20 flex gap-1">
          <button
            type="button"
            className="inline-flex size-8 items-center justify-center rounded-md border border-border bg-background/90 text-muted-foreground shadow-sm hover:text-foreground"
            aria-label="全屏编辑白板"
            onClick={() => {
              if (onFullscreen) {
                onFullscreen();
              } else {
                setFullscreenOpen(true);
              }
            }}
          >
            <Maximize2 className="size-4" aria-hidden />
          </button>
        </div>
      ) : null}

      {remotePointers.map((pointer) => (
        <div
          key={pointer.clientId}
          className="pointer-events-none absolute z-30 -translate-x-[2px] -translate-y-[2px]"
          style={{ left: pointer.x, top: pointer.y }}
        >
          <svg
            width="20"
            height="22"
            viewBox="0 0 20 22"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="drop-shadow"
            aria-hidden
          >
            <path
              d="M3.5 2.5L16.5 9.5L10.5 11L7.5 17.5L3.5 2.5Z"
              fill={pointer.color}
              stroke="#ffffff"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
          <span
            className="absolute left-4 top-3 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-medium text-white shadow"
            style={{ backgroundColor: pointer.color }}
          >
            {pointer.username}
          </span>
        </div>
      ))}

      {mountCanvas ? (
        <Suspense fallback={<WhiteboardSkeleton mode={mode} />}>
          <div className={cn("h-full w-full", mode === "page" && "min-h-0")}>
            <LazyExcalidraw
              excalidrawAPI={(instance) => {
                setApi(instance);
              }}
              onChange={handleChange}
              onPointerUpdate={handlePointerUpdate}
              viewModeEnabled={readonly}
              zenModeEnabled={mode === "embed"}
              gridModeEnabled={false}
              UIOptions={excalidrawUiOptions}
            />
          </div>
        </Suspense>
      ) : (
        <WhiteboardSkeleton mode={mode} />
      )}

      <WhiteboardFullscreenDialog
        open={fullscreenOpen}
        onOpenChange={setFullscreenOpen}
        ydoc={ydoc}
        scope={scope}
        awareness={awareness ?? null}
        readonly={readonly}
      />
    </div>
  );
}

export function WhiteboardSurface(props: WhiteboardSurfaceProps) {
  const [mountCanvas, setMountCanvas] = useState(props.mode === "page");
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (props.mode === "page") {
      setMountCanvas(true);
      return;
    }
    const node = containerRef.current;
    if (!node) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setMountCanvas(true);
            observer.disconnect();
          }
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [props.mode]);

  if (props.mode === "page") {
    return <WhiteboardSurfaceInner {...props} mountCanvas={mountCanvas} />;
  }

  return (
    <div ref={containerRef} className="w-full">
      <WhiteboardSurfaceInner {...props} mountCanvas={mountCanvas} />
    </div>
  );
}
