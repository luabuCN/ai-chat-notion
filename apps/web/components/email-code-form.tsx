"use client";

import Form from "next/form";
import { useActionState, useEffect, useState, useRef } from "react";
import { Input, Button, Label } from "@repo/ui";
import { toast } from "@/components/toast";
import {
  type SendCodeActionState,
  type VerifyCodeActionState,
  sendEmailCode,
  loginWithEmailCode,
} from "@/app/(auth)/actions";

interface EmailCodeFormProps {
  onSuccess?: () => void;
  onSwitchToPassword?: () => void;
}

export function EmailCodeForm({
  onSuccess,
  onSwitchToPassword,
}: EmailCodeFormProps) {
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const onSuccessRef = useRef(onSuccess);
  const hasCalledSuccess = useRef(false);

  // 保持 onSuccess 引用最新
  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  // 发送验证码状态
  const [sendState, sendAction, isSending] = useActionState<
    SendCodeActionState,
    FormData
  >(sendEmailCode, { status: "idle" });

  // 验证码登录状态
  const [verifyState, verifyAction, isVerifying] = useActionState<
    VerifyCodeActionState,
    FormData
  >(loginWithEmailCode, { status: "idle" });

  // 处理发送验证码结果
  useEffect(() => {
    if (sendState.status === "success") {
      toast({ type: "success", description: "验证码已发送到您的邮箱" });
      setStep("code");
      setCountdown(60);
    } else if (sendState.status === "rate_limited") {
      toast({ type: "error", description: "请求过于频繁，请稍后再试" });
    } else if (sendState.status === "invalid_data") {
      toast({ type: "error", description: "请输入有效的邮箱地址" });
    } else if (sendState.status === "failed") {
      toast({ type: "error", description: "发送验证码失败，请重试" });
    }
  }, [sendState.status]);

  // 处理验证码登录结果
  useEffect(() => {
    if (verifyState.status === "success" && !hasCalledSuccess.current) {
      hasCalledSuccess.current = true;
      onSuccessRef.current?.();
    } else if (verifyState.status === "invalid_code") {
      toast({ type: "error", description: "验证码错误" });
    } else if (verifyState.status === "expired") {
      toast({ type: "error", description: "验证码已过期，请重新获取" });
    } else if (verifyState.status === "failed") {
      toast({ type: "error", description: "登录失败，请重试" });
    }
  }, [verifyState.status]);

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
  const handleSendCode = (formData: FormData) => {
    const emailValue = formData.get("email") as string;
    setEmail(emailValue);
    sendAction(formData);
  };

  // 重新发送验证码
  const handleResendCode = () => {
    const formData = new FormData();
    formData.append("email", email);
    sendAction(formData);
    setCountdown(60);
  };

  // 返回修改邮箱
  const handleBackToEmail = () => {
    setStep("email");
  };

  if (step === "email") {
    return (
      <Form
        action={handleSendCode}
        className="flex flex-col gap-4 px-4 sm:px-16"
      >
        <div className="flex flex-col gap-2">
          <Label
            className="font-normal text-zinc-600 dark:text-zinc-400"
            htmlFor="email"
          >
            邮箱地址
          </Label>
          <Input
            autoComplete="email"
            autoFocus
            className="bg-muted text-md md:text-sm transition-all focus-visible:ring-primary/20 focus-visible:border-primary"
            defaultValue={email}
            id="email"
            name="email"
            placeholder="请输入邮箱地址"
            required
            type="email"
          />
        </div>

        <Button type="submit" disabled={isSending} className="w-full">
          {isSending ? "发送中..." : "获取验证码"}
        </Button>

        {onSwitchToPassword && (
          <button
            type="button"
            onClick={onSwitchToPassword}
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 text-center"
          >
            使用密码登录
          </button>
        )}
      </Form>
    );
  }

  return (
    <Form action={verifyAction} className="flex flex-col gap-4 px-4 sm:px-16">
      <input type="hidden" name="email" value={email} />

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label
            className="font-normal text-zinc-600 dark:text-zinc-400"
            htmlFor="code"
          >
            验证码
          </Label>
          <span className="text-xs text-zinc-500">已发送至 {email}</span>
        </div>
        <Input
          autoComplete="one-time-code"
          autoFocus
          className="bg-muted text-md md:text-sm transition-all focus-visible:ring-primary/20 focus-visible:border-primary tracking-widest text-center"
          id="code"
          name="code"
          placeholder="请输入6位验证码"
          required
          maxLength={6}
          pattern="[0-9]{6}"
        />
      </div>

      <Button type="submit" disabled={isVerifying} className="w-full">
        {isVerifying ? "登录中..." : "登录"}
      </Button>

      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={handleBackToEmail}
          className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          修改邮箱
        </button>
        <button
          type="button"
          onClick={handleResendCode}
          disabled={countdown > 0 || isSending}
          className="text-primary hover:underline disabled:text-zinc-400 disabled:no-underline disabled:cursor-not-allowed"
        >
          {countdown > 0 ? `${countdown}秒后重发` : "重新发送"}
        </button>
      </div>
    </Form>
  );
}
