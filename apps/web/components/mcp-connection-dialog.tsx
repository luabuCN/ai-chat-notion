"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  Button,
} from "@repo/ui";
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  Plug,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "./toast";

interface McpConnectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TokenInfo {
  hasToken: boolean;
  createdAt: string | null;
}

export function McpConnectionDialog({
  open,
  onOpenChange,
}: McpConnectionDialogProps) {
  const [tokenInfo, setTokenInfo] = useState<TokenInfo>({
    hasToken: false,
    createdAt: null,
  });
  const [fullToken, setFullToken] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const mcpServerUrl = `${process.env.NEXT_PUBLIC_API_URL || ""}/api/mcp`;

  const fetchToken = useCallback(async () => {
    try {
      const res = await fetch("/api/mcp-token", { method: "GET" });
      if (!res.ok) return;
      const data = await res.json();
      setTokenInfo({
        hasToken: data.hasToken,
        createdAt: data.createdAt,
      });
      setFullToken(null);
      setShowToken(false);
    } catch {
      // 静默失败
    }
  }, []);

  useEffect(() => {
    if (open) {
      void fetchToken();
    }
  }, [open, fetchToken]);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/mcp-token", { method: "POST" });
      if (!res.ok) {
        toast({ type: "error", description: "生成 Token 失败" });
        return;
      }
      const data = await res.json();
      setFullToken(data.token);
      setShowToken(true);
      setTokenInfo({
        hasToken: true,
        createdAt: data.createdAt,
      });
      toast({ type: "success", description: "Token 生成成功" });
    } catch {
      toast({ type: "error", description: "生成 Token 失败" });
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async () => {
    if (!confirm("确定要吊销当前 Token 吗？吊销后使用此 Token 的连接将立即失效。")) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/mcp-token", { method: "DELETE" });
      if (!res.ok) {
        toast({ type: "error", description: "吊销 Token 失败" });
        return;
      }
      setTokenInfo({ hasToken: false, createdAt: null });
      setFullToken(null);
      setShowToken(false);
      toast({ type: "success", description: "Token 已吊销" });
    } catch {
      toast({ type: "error", description: "吊销 Token 失败" });
    } finally {
      setLoading(false);
    }
  };

  const hasToken = tokenInfo.hasToken;
  const displayToken = fullToken && showToken ? fullToken : null;

  const configJson = useMemo(() => {
    const tokenForConfig = fullToken || "<your-token>";
    const config = {
      mcpServers: {
        zhizuo: {
          type: "streamable-http",
          url: mcpServerUrl,
          headers: {
            Authorization: `Bearer ${tokenForConfig}`,
          },
        },
      },
    };
    return JSON.stringify(config, null, 2);
  }, [fullToken, mcpServerUrl]);

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(configJson);
      setCopied(true);
      toast({ type: "success", description: "已复制 JSON 配置" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ type: "error", description: "复制失败" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden sm:max-w-[480px]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Plug className="size-5 text-zinc-500" />
            <DialogTitle className="text-base font-semibold">
              MCP 连接
            </DialogTitle>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => onOpenChange(false)}
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="min-w-0 space-y-4">
          {/* MCP Server URL */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              MCP Server URL
            </label>
            <div className="flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/50">
              <code className="flex-1 truncate text-sm text-zinc-600 dark:text-zinc-400">
                {mcpServerUrl}
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 shrink-0"
                onClick={() => {
                  void navigator.clipboard.writeText(mcpServerUrl);
                  toast({ type: "success", description: "已复制 URL" });
                }}
              >
                <Copy className="size-3.5" />
              </Button>
            </div>
          </div>

          {/* API Token */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                API Token
              </label>
              <div className="flex items-center gap-1">
                {hasToken && (
                  <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                    <span className="size-1.5 rounded-full bg-green-500" />
                    活跃
                  </span>
                )}
                {!hasToken && (
                  <span className="flex items-center gap-1 text-xs text-zinc-400">
                    <span className="size-1.5 rounded-full bg-zinc-300" />
                    未生成
                  </span>
                )}
              </div>
            </div>

            {hasToken ? (
              <div className="flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/50">
                <code className="flex-1 truncate text-sm text-zinc-600 dark:text-zinc-400">
                  {displayToken || "••••••••••••••••"}
                </code>
                {fullToken && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 shrink-0"
                    onClick={() => setShowToken(!showToken)}
                  >
                    {showToken ? (
                      <EyeOff className="size-3.5" />
                    ) : (
                      <Eye className="size-3.5" />
                    )}
                  </Button>
                )}
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-zinc-300 px-3 py-2 text-center text-sm text-zinc-400 dark:border-zinc-700">
                尚未生成 Token
              </div>
            )}

            {fullToken && showToken && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                请妥善保存，关闭对话框后将不再显示完整明文。
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            {!hasToken && (
              <Button
                size="sm"
                onClick={handleGenerate}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                生成 Token
              </Button>
            )}

            {hasToken && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleGenerate}
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <RefreshCw className="size-4" />
                  )}
                  重新生成
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRevoke}
                  disabled={loading}
                >
                  <Trash2 className="size-4" />
                  吊销
                </Button>
              </>
            )}

          </div>

          {/* JSON Config Preview */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                JSON 配置
              </label>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs"
                onClick={handleCopyJson}
              >
                {copied ? (
                  <>
                    <Check className="size-3.5" />
                    已复制
                  </>
                ) : (
                  <>
                    <Copy className="size-3.5" />
                    一键复制
                  </>
                )}
              </Button>
            </div>
            <pre className="max-h-48 w-full overflow-x-auto rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400">
              <code className="whitespace-pre-wrap break-all">{configJson}</code>
            </pre>
            {!fullToken && hasToken && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                配置中的 token 为占位符，请重新生成 Token 以获取可用的完整配置。
              </p>
            )}
            {!hasToken && (
              <p className="text-xs text-zinc-400">
                请先生成 Token 以获取可用的配置。
              </p>
            )}
          </div>

          {/* Help text */}
          <div className="space-y-2 rounded-md bg-zinc-50 p-3 text-xs text-zinc-500 dark:bg-zinc-800/50 dark:text-zinc-400">
            <div>
              <p className="mb-1 font-medium text-zinc-600 dark:text-zinc-300">
                如何使用
              </p>
              <p>
                复制上方配置，粘贴到对应 MCP 客户端的配置文件中。本服务使用 streamable-http 传输协议，非 stdio 类型。
              </p>
            </div>
            <div>
              <p className="mb-1 font-medium text-zinc-600 dark:text-zinc-300">
                配置文件位置
              </p>
              <ul className="ml-4 list-disc space-y-0.5">
                <li>Claude Desktop: %APPDATA%\Claude\claude_desktop_config.json</li>
                <li>Cursor: ~/.cursor/mcp.json</li>
                <li>VS Code: 设置界面 → MCP Servers</li>
              </ul>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
