"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useActionState, useEffect, useState } from "react";

import { AuthForm } from "@/components/auth-form";
import { EmailCodeForm } from "@/components/email-code-form";
import { SubmitButton } from "@/components/submit-button";
import { toast } from "@/components/toast";
import { dispatchMainSiteAuthChangedEvent } from "@/lib/extension-auth-event";
import { type LoginActionState, login } from "../actions";

export default function Page() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [email, setEmail] = useState("");
  const [isSuccessful, setIsSuccessful] = useState(false);
  const [loginMode, setLoginMode] = useState<"password" | "code">("password");

  const [state, formAction] = useActionState<LoginActionState, FormData>(
    login,
    {
      status: "idle",
    }
  );

  const { update: updateSession } = useSession();

  useEffect(() => {
    if (state.status === "failed") {
      toast({
        type: "error",
        description: "用户名或密码错误",
      });
    } else if (state.status === "invalid_data") {
      toast({
        type: "error",
        description: "请输入有效的登录信息",
      });
    } else if (state.status === "success") {
      setIsSuccessful(true);
      updateSession();
      dispatchMainSiteAuthChangedEvent();
      router.push(callbackUrl);
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  const handleSubmit = (formData: FormData) => {
    setEmail(formData.get("email") as string);
    formAction(formData);
  };

  const handleCodeLoginSuccess = () => {
    setIsSuccessful(true);
    updateSession();
    dispatchMainSiteAuthChangedEvent();
    router.push(callbackUrl);
    router.refresh();
  };

  return (
    <div className="flex h-dvh w-screen items-start justify-center bg-muted/40 pt-12 md:items-center md:pt-0">
      <div className="absolute inset-0 -z-10 h-full w-full bg-background" />

      <div className="flex w-full max-w-md flex-col gap-8 overflow-hidden rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)] sm:p-0 sm:py-12">
        <div className="flex flex-col items-center justify-center gap-2 px-4 text-center sm:px-16">
          <h3 className="font-bold text-[26px] leading-[1.23] tracking-[-0.625px]">
            欢迎回来
          </h3>
          <p className="text-muted-foreground text-sm">
            {loginMode === "password"
              ? "输入您的账号密码登录"
              : "输入邮箱获取验证码登录"}
          </p>
        </div>

        {/* 登录方式切换 */}
        <div className="flex gap-2 px-4 sm:px-16">
          <button
            type="button"
            onClick={() => setLoginMode("password")}
            className={`flex-1 py-2 text-sm rounded-lg transition-colors ${
              loginMode === "password"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-accent"
            }`}
          >
            密码登录
          </button>
          <button
            type="button"
            onClick={() => setLoginMode("code")}
            className={`flex-1 py-2 text-sm rounded-lg transition-colors ${
              loginMode === "code"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-accent"
            }`}
          >
            验证码登录
          </button>
        </div>

        {loginMode === "password" ? (
          <AuthForm action={handleSubmit} defaultEmail={email}>
            <SubmitButton isSuccessful={isSuccessful}>登录</SubmitButton>
            <div className="mt-4 flex items-center justify-between gap-4">
              <div className="h-px flex-1 bg-border" />
              <span className="text-muted-foreground text-xs uppercase">或</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <button
              className="mt-4 flex w-full items-center justify-center gap-3 rounded-[4px] border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring/25"
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
              使用 GitHub 登录
            </button>

            <p className="mt-4 text-center text-muted-foreground text-sm">
              {"还没有账号？ "}
              <Link
                className="font-semibold text-primary hover:underline"
                href="/register"
              >
                免费注册
              </Link>
            </p>
          </AuthForm>
        ) : (
          <>
            <EmailCodeForm onSuccess={handleCodeLoginSuccess} />

            <div className="px-4 sm:px-16">
              <div className="flex items-center justify-between gap-4">
                <div className="h-px flex-1 bg-border" />
                <span className="text-muted-foreground text-xs uppercase">或</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <button
                className="mt-4 flex w-full items-center justify-center gap-3 rounded-[4px] border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring/25"
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
                使用 GitHub 登录
              </button>

              <p className="mt-4 text-center text-muted-foreground text-sm">
                {"还没有账号？ "}
                <Link
                  className="font-semibold text-primary hover:underline"
                  href="/register"
                >
                  免费注册
                </Link>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
