import { Server, Extension } from "@hocuspocus/server";
import { Logger } from "@hocuspocus/extension-logger";
import { databaseExtension } from "./extensions/database.js";
import { getSafeRedisExtension } from "./extensions/redis.js";
import { verifyToken, verifyDocumentAccess } from "./auth.js";

export async function startServer(port: number) {
  // 构建基础扩展列表
  const extensions: Extension[] = [
    new Logger({
      log: (message) => {
        console.log(`[Hocuspocus] ${message}`);
      },
      onLoadDocument: true,
      onChange: false, // 不记录每次变更，太多了
      onConnect: true,
      onDisconnect: true,
      onUpgrade: false,
      onRequest: false,
      onDestroy: true,
      onConfigure: true,
    }),
    databaseExtension,
  ];

  // 安全地加载 Redis 扩展
  const redisExtension = await getSafeRedisExtension();
  if (redisExtension) {
    extensions.push(redisExtension);
    console.log("✅ Redis extension enabled for multi-instance sync");
  } else {
    console.log("⚠️  Redis extension disabled (Single-instance mode)");
  }

  const server = new Server({
    port,
    timeout: 30000,
    debounce: 2000, // 文档变更后 2 秒触发持久化
    maxDebounce: 10000, // 最多等待 10 秒

    extensions,

    // 身份验证
    async onAuthenticate({ token, documentName, connectionConfig }) {
      console.log(`[Auth] Authenticating for document: ${documentName}`);

      // 验证 JWT token
      const payload = await verifyToken(token);
      if (!payload) {
        throw new Error("Invalid or expired token");
      }

      // 验证文档访问权限（包括工作空间成员和访客协作者）
      const { access, document } = await verifyDocumentAccess(
        documentName,
        payload.userId,
        payload.email // 传递邮箱用于检查访客协作者权限
      );

      if (access === "none") {
        throw new Error("You don't have access to this document");
      }

      // view 权限的用户标记为只读连接
      if (access === "view") {
        connectionConfig.readOnly = true;
      }

      // 返回用户信息，可在其他钩子中使用
      return {
        user: {
          id: payload.userId,
          name: payload.name || payload.email?.split("@")[0] || "Anonymous",
          email: payload.email,
        },
        accessLevel: access,
        document,
      };
    },

    // 连接建立时
    async onConnect({ documentName, context }) {
      const userName = context?.user?.name || context?.user?.id || "Unknown";
      console.log(
        `[Connect] User ${userName} (${
          context?.user?.email || "no email"
        }) connected to document ${documentName}`
      );
    },

    // 断开连接时
    async onDisconnect({ documentName, context }) {
      console.log(
        `[Disconnect] User ${context?.user?.name} disconnected from document ${documentName}`
      );
    },

    // 加载文档时（在数据库扩展之后）
    async onLoadDocument({ documentName, document, context }) {
      try {
        const fragment = document.getXmlFragment("default");
        console.log(
          `[Load] Document ${documentName} loaded with ${fragment.length} items`
        );
      } catch (e) {
        console.log(
          `[Load] Document ${documentName} loaded (unable to count items)`
        );
      }
    },

    // 文档变更时：二次校验写权限
    async onChange({ documentName, context, transactionOrigin }) {
      const user = context?.user;
      if (!user?.id) {
        return;
      }

      try {
        const { access } = await verifyDocumentAccess(
          documentName,
          user.id,
          user.email
        );

        if (access !== "owner" && access !== "edit") {
          console.warn(
            `[Auth] Permission revoked for user ${user.id} on document ${documentName} (now: ${access}), closing connection`
          );
          // 关闭该用户的 WebSocket 连接，客户端会收到 close 事件
          // 使用自定义 code 4003 让客户端区分"权限变更"和普通断连
          try {
            if (
              transactionOrigin &&
              typeof transactionOrigin === "object" &&
              transactionOrigin.webSocket &&
              typeof transactionOrigin.webSocket.close === "function"
            ) {
              transactionOrigin.webSocket.close(4003, "permission_changed");
            }
          } catch (closeError) {
            console.error(
              `[Auth] Error closing connection for ${documentName}:`,
              closeError
            );
          }
        }
      } catch (error) {
        // 校验错误（如数据库超时）不立即断开，仅记录日志
        console.error(
          `[Auth] Error verifying permission for ${documentName}:`,
          error
        );
      }
    },

    // 存储文档时（在数据库扩展之后）
    async onStoreDocument({ documentName, context }) {
      console.log(`[Store] Document ${documentName} stored successfully`);
    },
  });

  server.listen();

  console.log(`✅ Hocuspocus server running on ws://localhost:${port}`);
  console.log(`📝 Ready to handle collaborative editing sessions`);

  // 优雅关闭
  process.on("SIGINT", async () => {
    console.log("\n🛑 Shutting down gracefully...");
    await server.destroy();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    console.log("\n🛑 Shutting down gracefully...");
    await server.destroy();
    process.exit(0);
  });

  return server;
}
