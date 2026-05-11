"use client";

import { Button } from "@repo/ui/button";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useState } from "react";

/**
 * 预览页右上角：浅色 / 暗黑切换（沿用根布局的 ThemeProvider）
 */
export function PreviewThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggle = useCallback(() => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setTheme]);

  if (!mounted) {
    return (
      <div
        className="fixed top-4 right-4 z-50 size-10 shrink-0"
        aria-hidden
      />
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <div className="fixed top-4 right-4 z-50">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        title={isDark ? "切换为浅色模式" : "切换为暗黑模式"}
        className="size-10 cursor-pointer"
        onClick={toggle}
      >
        {isDark ? (
          <Sun className="size-5" aria-hidden />
        ) : (
          <Moon className="size-5" aria-hidden />
        )}
        <span className="sr-only">
          {isDark ? "切换为浅色模式" : "切换为暗黑模式"}
        </span>
      </Button>
    </div>
  );
}
