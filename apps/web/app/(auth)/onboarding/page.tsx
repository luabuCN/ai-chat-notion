"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useActionState, useEffect, useState } from "react";
import { Input } from "@repo/ui";
import { Label } from "@repo/ui";
import { SubmitButton } from "@/components/submit-button";
import { toast } from "@/components/toast";
import { type OnboardingActionState, completeOnboarding } from "../actions";

export default function Page() {
  const router = useRouter();
  const { data: session, update: updateSession } = useSession();
  const [isSuccessful, setIsSuccessful] = useState(false);

  const [state, formAction] = useActionState<OnboardingActionState, FormData>(
    completeOnboarding,
    {
      status: "idle",
    }
  );

  useEffect(() => {
    if (state.status === "user_exists") {
      toast({ type: "error", description: "Username already taken!" });
    } else if (state.status === "failed") {
      toast({ type: "error", description: "Failed to complete onboarding!" });
    } else if (state.status === "invalid_data") {
      toast({ type: "error", description: "Invalid username!" });
    } else if (state.status === "success" && !isSuccessful) {
      setIsSuccessful(true);
      toast({ type: "success", description: "Welcome!" });

      // 获取输入框里的名字（或者从 state 传回，这里为了简单直接从页面逻辑获取）
      // 实际上 updateSession 应该传递数据才能触发 jwt callback 的 trigger: "update"
      const nameInput = (document.getElementById("name") as HTMLInputElement)
        ?.value;

      updateSession({ name: nameInput }).then(() => {
        router.push("/");
        router.refresh();
      });
    }
  }, [state.status, isSuccessful, router, updateSession]);

  // 如果已经有名字了，说明引导已完成，直接跳转首页
  useEffect(() => {
    if (session?.user?.name && !isSuccessful) {
      router.push("/");
    }
  }, [session?.user?.name, isSuccessful, router]);

  return (
    <div className="flex h-dvh w-screen items-start justify-center bg-gray-50/50 dark:bg-zinc-950/50 pt-12 md:items-center md:pt-0">
      <div className="absolute inset-0 -z-10 h-full w-full bg-white dark:bg-zinc-950 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-size-[14px_24px]">
        <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-primary/5 opacity-20 blur-[100px]" />
      </div>

      <div className="flex w-full max-w-md flex-col gap-8 overflow-hidden rounded-2xl bg-background border border-zinc-200 dark:border-zinc-800 p-4 shadow-xl shadow-zinc-200/50 dark:shadow-none sm:p-0 sm:py-12">
        <div className="flex flex-col items-center justify-center gap-2 px-4 text-center sm:px-16">
          <h3 className="font-semibold text-2xl tracking-tight dark:text-zinc-50">
            One Last Step
          </h3>
          <p className="text-muted-foreground text-sm">
            Please choose a username for your account
          </p>
        </div>

        <form action={formAction} className="flex flex-col gap-4 px-4 sm:px-16">
          <div className="flex flex-col gap-2">
            <Label
              className="font-normal text-zinc-600 dark:text-zinc-400"
              htmlFor="name"
            >
              Username
            </Label>
            <Input
              autoComplete="name"
              autoFocus
              className="bg-muted text-md md:text-sm transition-all focus-visible:ring-primary/20 focus-visible:border-primary"
              id="name"
              name="name"
              placeholder="johndoe"
              required
              type="text"
            />
          </div>
          <SubmitButton isSuccessful={isSuccessful}>
            Complete Setup
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}
