"use server";

import { z } from "zod";

import { createUser, getUser } from "@repo/database";

import { signIn } from "./auth";

const loginFormSchema = z.object({
  identifier: z.string().min(3),
  password: z.string().min(6),
});

const registerFormSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2).max(100),
});

export type LoginActionState = {
  status: "idle" | "in_progress" | "success" | "failed" | "invalid_data";
};

export const login = async (
  _: LoginActionState,
  formData: FormData
): Promise<LoginActionState> => {
  try {
    const validatedData = loginFormSchema.parse({
      identifier: formData.get("email"), // 仍然使用 email 作为 input name，但内容可以是用户名
      password: formData.get("password"),
    });

    const result = await signIn("credentials", {
      email: validatedData.identifier,
      password: validatedData.password,
      redirect: false,
    });

    if (result?.error) {
      return { status: "failed" };
    }

    return { status: "success" };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { status: "invalid_data" };
    }

    return { status: "failed" };
  }
};

export type RegisterActionState = {
  status:
    | "idle"
    | "in_progress"
    | "success"
    | "failed"
    | "user_exists"
    | "invalid_data";
};

const onboardingFormSchema = z.object({
  name: z.string().min(2).max(100),
});

export type OnboardingActionState = {
  status:
    | "idle"
    | "in_progress"
    | "success"
    | "failed"
    | "user_exists"
    | "invalid_data"
    | "not_logged_in";
};

export const completeOnboarding = async (
  _: OnboardingActionState,
  formData: FormData
): Promise<OnboardingActionState> => {
  try {
    const { auth } = await import("./auth");
    const session = await auth();
    if (!session?.user?.id) {
      return { status: "not_logged_in" };
    }

    const name = formData.get("name") as string;
    const validatedData = onboardingFormSchema.parse({ name });

    // 检查用户名是否已存在
    const [existingName] = await getUser(validatedData.name);
    if (existingName && existingName.id !== session.user.id) {
      return { status: "user_exists" };
    }

    const { prisma: db } = await import("@repo/database");
    await db.user.update({
      where: { id: session.user.id },
      data: { name: validatedData.name },
    });
    return { status: "success" };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { status: "invalid_data" };
    }

    return { status: "failed" };
  }
};

export const register = async (
  _: RegisterActionState,
  formData: FormData
): Promise<RegisterActionState> => {
  try {
    const validatedData = registerFormSchema.parse({
      email: formData.get("email"),
      password: formData.get("password"),
      name: formData.get("name"),
    });

    const [existingUser] = await getUser(validatedData.email);
    if (existingUser) {
      return { status: "user_exists" };
    }

    const [existingName] = await getUser(validatedData.name);
    if (existingName) {
      return { status: "user_exists" };
    }

    await createUser(
      validatedData.email,
      validatedData.password,
      validatedData.name
    );

    await signIn("credentials", {
      email: validatedData.email,
      password: validatedData.password,
      redirect: false,
    });

    return { status: "success" };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { status: "invalid_data" };
    }

    return { status: "failed" };
  }
};
