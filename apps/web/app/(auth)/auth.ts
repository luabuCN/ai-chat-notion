import { compare } from "bcrypt-ts";
import NextAuth, { type DefaultSession } from "next-auth";
import type { DefaultJWT } from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma, createWorkspace, generateWorkspaceSlug } from "@repo/database";
import { DUMMY_PASSWORD } from "@/lib/constants";
import { getUser } from "@repo/database";
import { authConfig } from "./auth.config";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      avatarUrl?: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    id?: string;
    email?: string | null;
    name?: string | null;
    avatarUrl?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    name?: string | null;
    avatarUrl?: string | null;
  }
}

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [
    GitHub({
      allowDangerousEmailAccountLinking: true,
      profile(profile) {
        return {
          id: profile.id.toString(),
          name: null, // 为 null 以触发 Onboarding 流程
          email: profile.email,
          avatarUrl: profile.avatar_url,
        };
      },
    }),
    Credentials({
      credentials: {},
      async authorize({ email, password }: any) {
        // 这里的 email 实际上是前端传来的 identifier (email 或 username)
        const users = await getUser(email);

        if (users.length === 0) {
          await compare(password, DUMMY_PASSWORD);
          return null;
        }

        const [user] = users;

        if (!user.password) {
          // 如果用户没有设置密码（可能是由 OAuth 创建的），则不允许 Credentials 登录
          await compare(password, DUMMY_PASSWORD);
          return null;
        }

        const passwordsMatch = await compare(password, user.password);

        if (!passwordsMatch) {
          return null;
        }

        return user;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id as string;
        token.name = user.name;
        token.avatarUrl = (user as any).avatarUrl;
      }

      if (trigger === "update") {
        console.log("JWT Callback: Triggered update", session);
        if (session?.name) {
          token.name = session.name;
        }

        if (session?.avatarUrl) {
          token.avatarUrl = session.avatarUrl;
        }

        // 如果没有传入数据，或者为了保险，从数据库拉取一次
        if (!session?.name) {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id },
          });

          if (dbUser) {
            token.name = dbUser.name;
            token.avatarUrl = dbUser.avatarUrl;
          }
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.name = token.name;
        session.user.avatarUrl = token.avatarUrl;
      }

      return session;
    },
  },
  events: {
    async createUser({ user }) {
      // 仅当用户来自 OAuth 且没有工作空间时运行（Credential 用户在 queries/user.ts 中已经处理了）
      if (user.id) {
        const workspace = await createWorkspace({
          name: "我的空间",
          slug: generateWorkspaceSlug(),
          ownerId: user.id,
        });

        await prisma.user.update({
          where: { id: user.id },
          data: { currentWorkspaceId: workspace.id },
        });
      }
    },
  },
});
