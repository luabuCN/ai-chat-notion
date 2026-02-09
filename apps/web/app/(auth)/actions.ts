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
  code: z.string().length(6),
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
    | "invalid_data"
    | "invalid_code"
    | "code_expired";
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
      code: formData.get("code"),
    });

    const { prisma: db } = await import("@repo/database");

    // 验证邮箱验证码
    const verificationCode = await db.emailVerificationCode.findFirst({
      where: {
        email: validatedData.email,
        code: validatedData.code,
      },
    });

    if (!verificationCode) {
      return { status: "invalid_code" as any };
    }

    if (verificationCode.expiresAt < new Date()) {
      await db.emailVerificationCode.delete({
        where: { id: verificationCode.id },
      });
      return { status: "code_expired" as any };
    }

    // 删除已使用的验证码
    await db.emailVerificationCode.delete({
      where: { id: verificationCode.id },
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

// ==================== 邮箱验证码登录 ====================

const emailCodeSchema = z.object({
  email: z.string().email(),
});

const verifyCodeSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

export type SendCodeActionState = {
  status:
    | "idle"
    | "in_progress"
    | "success"
    | "failed"
    | "invalid_data"
    | "rate_limited";
};

export type VerifyCodeActionState = {
  status:
    | "idle"
    | "in_progress"
    | "success"
    | "failed"
    | "invalid_data"
    | "invalid_code"
    | "expired";
};

// 生成6位数字验证码
function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// 发送邮箱验证码
export const sendEmailCode = async (
  _: SendCodeActionState,
  formData: FormData
): Promise<SendCodeActionState> => {
  try {
    const validatedData = emailCodeSchema.parse({
      email: formData.get("email"),
    });

    const { prisma: db } = await import("@repo/database");
    const { sendVerificationCodeEmail } = await import("@/lib/email");

    // 检查是否有 60 秒内发送的验证码（防止频繁发送）
    const recentCode = await db.emailVerificationCode.findFirst({
      where: {
        email: validatedData.email,
        createdAt: {
          gt: new Date(Date.now() - 60 * 1000),
        },
      },
    });

    if (recentCode) {
      return { status: "rate_limited" };
    }

    // 删除该邮箱之前的验证码
    await db.emailVerificationCode.deleteMany({
      where: { email: validatedData.email },
    });

    // 生成新验证码
    const code = generateCode();

    // 存储验证码（5分钟过期）
    await db.emailVerificationCode.create({
      data: {
        email: validatedData.email,
        code,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    // 发送邮件
    const result = await sendVerificationCodeEmail(validatedData.email, code);

    if (!result.success) {
      console.error("发送验证码失败:", result.error);
      return { status: "failed" };
    }

    return { status: "success" };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { status: "invalid_data" };
    }

    console.error("发送验证码异常:", error);
    return { status: "failed" };
  }
};

// 验证码登录
export const loginWithEmailCode = async (
  _: VerifyCodeActionState,
  formData: FormData
): Promise<VerifyCodeActionState> => {
  try {
    const validatedData = verifyCodeSchema.parse({
      email: formData.get("email"),
      code: formData.get("code"),
    });

    const { prisma: db } = await import("@repo/database");

    // 查找验证码
    const verificationCode = await db.emailVerificationCode.findFirst({
      where: {
        email: validatedData.email,
        code: validatedData.code,
      },
    });

    if (!verificationCode) {
      return { status: "invalid_code" };
    }

    // 检查是否过期
    if (verificationCode.expiresAt < new Date()) {
      await db.emailVerificationCode.delete({
        where: { id: verificationCode.id },
      });
      return { status: "expired" };
    }

    // 删除已使用的验证码
    await db.emailVerificationCode.delete({
      where: { id: verificationCode.id },
    });

    // 使用 email-code provider 登录
    const result = await signIn("email-code", {
      email: validatedData.email,
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

    console.error("验证码登录异常:", error);
    return { status: "failed" };
  }
};
