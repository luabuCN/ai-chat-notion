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
