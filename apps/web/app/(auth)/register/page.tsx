"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useActionState, useEffect, useState, useRef } from "react";
import { Input, Button, Label } from "@repo/ui";
import { SubmitButton } from "@/components/submit-button";
import { toast } from "@/components/toast";
import {
  type RegisterActionState,
  type SendCodeActionState,
  register,
  sendEmailCode,
} from "../actions";

export default function Page() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [isSuccessful, setIsSuccessful] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  // 注册状态
  const [state, formAction] = useActionState<RegisterActionState, FormData>(
    register,
    { status: "idle" }
  );

  // 发送验证码状态
  const [sendState, sendAction, isSending] = useActionState<
    SendCodeActionState,
    FormData
  >(sendEmailCode, { status: "idle" });

  const { update: updateSession } = useSession();

  // 处理注册结果
  useEffect(() => {
    if (state.status === "user_exists") {
      toast({ type: "error", description: "该邮箱或用户名已被注册" });
    } else if (state.status === "failed") {
      toast({ type: "error", description: "注册失败，请重试" });
    } else if (state.status === "invalid_data") {
      toast({ type: "error", description: "请填写完整的注册信息" });
    } else if (state.status === "invalid_code") {
      toast({ type: "error", description: "验证码错误" });
    } else if (state.status === "code_expired") {
      toast({ type: "error", description: "验证码已过期，请重新获取" });
    } else if (state.status === "success") {
      toast({ type: "success", description: "注册成功！" });
      setIsSuccessful(true);
      updateSession();
      router.push(callbackUrl);
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  // 处理发送验证码结果
  useEffect(() => {
    if (sendState.status === "success") {
      toast({ type: "success", description: "验证码已发送到您的邮箱" });
      setCountdown(60);
    } else if (sendState.status === "rate_limited") {
      toast({ type: "error", description: "请求过于频繁，请稍后再试" });
    } else if (sendState.status === "invalid_data") {
      toast({ type: "error", description: "请输入有效的邮箱地址" });
    } else if (sendState.status === "failed") {
      toast({ type: "error", description: "发送验证码失败，请重试" });
    }
  }, [sendState.status]);

  // 倒计时
  useEffect(() => {
    if (countdown > 0) {
      countdownRef.current = setTimeout(() => {
        setCountdown((c) => c - 1);
      }, 1000);
    }
    return () => {
      if (countdownRef.current) {
        clearTimeout(countdownRef.current);
      }
    };
  }, [countdown]);

  // 发送验证码
  const handleSendCode = () => {
    const emailInput = document.getElementById("email") as HTMLInputElement;
    if (!emailInput?.value) {
      toast({ type: "error", description: "请先输入邮箱地址" });
      return;
    }
    const formData = new FormData();
    formData.append("email", emailInput.value);
    sendAction(formData);
  };

  return (
    <div className="flex h-dvh w-screen items-start justify-center bg-gray-50/50 dark:bg-zinc-950/50 pt-12 md:items-center md:pt-0">
      <div className="absolute inset-0 -z-10 h-full w-full bg-white dark:bg-zinc-950 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-size-[14px_24px]">
        <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-primary/5 opacity-20 blur-[100px]" />
      </div>

      <div className="flex w-full max-w-md flex-col gap-8 overflow-hidden rounded-2xl bg-background border border-zinc-200 dark:border-zinc-800 p-4 shadow-xl shadow-zinc-200/50 dark:shadow-none sm:p-0 sm:py-12">
        <div className="flex flex-col items-center justify-center gap-2 px-4 text-center sm:px-16">
          <h3 className="font-semibold text-2xl tracking-tight dark:text-zinc-50">
            创建账号
          </h3>
          <p className="text-muted-foreground text-sm">填写以下信息完成注册</p>
        </div>

        <form action={formAction} className="flex flex-col gap-4 px-4 sm:px-16">
          {/* 用户名 */}
          <div className="flex flex-col gap-2">
            <Label
              className="font-normal text-zinc-600 dark:text-zinc-400"
              htmlFor="name"
            >
              用户名
            </Label>
            <Input
              autoComplete="username"
              autoFocus
              className="bg-muted text-md md:text-sm"
              id="name"
              name="name"
              placeholder="请输入用户名"
              required
              minLength={2}
              maxLength={100}
            />
          </div>

          {/* 邮箱 */}
          <div className="flex flex-col gap-2">
            <Label
              className="font-normal text-zinc-600 dark:text-zinc-400"
              htmlFor="email"
            >
              邮箱地址
            </Label>
            <Input
              autoComplete="email"
              className="bg-muted text-md md:text-sm"
              id="email"
              name="email"
              placeholder="请输入邮箱地址"
              required
              type="email"
            />
          </div>

          {/* 验证码 */}
          <div className="flex flex-col gap-2">
            <Label
              className="font-normal text-zinc-600 dark:text-zinc-400"
              htmlFor="code"
            >
              邮箱验证码
            </Label>
            <div className="flex gap-2">
              <Input
                autoComplete="one-time-code"
                className="bg-muted text-md md:text-sm flex-1"
                id="code"
                name="code"
                placeholder="6位验证码"
                required
                maxLength={6}
                pattern="[0-9]{6}"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleSendCode}
                disabled={countdown > 0 || isSending}
                className="whitespace-nowrap"
              >
                {isSending
                  ? "发送中..."
                  : countdown > 0
                  ? `${countdown}秒`
                  : "获取验证码"}
              </Button>
            </div>
          </div>

          {/* 密码 */}
          <div className="flex flex-col gap-2">
            <Label
              className="font-normal text-zinc-600 dark:text-zinc-400"
              htmlFor="password"
            >
              密码
            </Label>
            <Input
              autoComplete="new-password"
              className="bg-muted text-md md:text-sm"
              id="password"
              name="password"
              placeholder="请输入密码（至少6位）"
              required
              type="password"
              minLength={6}
            />
          </div>

          <SubmitButton isSuccessful={isSuccessful}>注册</SubmitButton>

          <div className="mt-4 flex items-center justify-between gap-4">
            <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
            <span className="text-zinc-500 text-xs uppercase">或</span>
            <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          </div>

          <button
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            onClick={() => {
              import("next-auth/react").then((m) =>
                m.signIn("github", { callbackUrl })
              );
            }}
            type="button"
          >
            <svg
              className="h-5 w-5"
              fill="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
            </svg>
            使用 GitHub 注册
          </button>

          <p className="mt-4 text-center text-gray-600 text-sm dark:text-zinc-400">
            {"已有账号？ "}
            <Link
              className="font-semibold text-primary hover:underline"
              href="/login"
            >
              立即登录
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
