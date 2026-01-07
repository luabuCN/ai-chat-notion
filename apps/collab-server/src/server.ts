import { Server } from "@hocuspocus/server";
import { Logger } from "@hocuspocus/extension-logger";
import { databaseExtension } from "./extensions/database.js";
import { verifyToken, verifyDocumentAccess } from "./auth.js";

export function startServer(port: number) {
  const server = Server.configure({
    port,
    timeout: 30000,
    debounce: 2000, // 文档变更后 2 秒触发持久化
    maxDebounce: 10000, // 最多等待 10 秒

    extensions: [
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
    ],

    // 身份验证
    async onAuthenticate({ token, documentName, connection }) {
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
      console.log(
        `[Connect] User ${context?.user?.name} connected to document ${documentName}`
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
      console.log(
        `[Load] Document ${documentName} loaded with ${
          document.getArray("default").length
        } items`
      );
    },

    // 文档变更时
    async onChange({ documentName, context }) {
      // 可以在这里添加额外的变更处理逻辑
      // 例如：通知其他服务、触发 webhook 等
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
