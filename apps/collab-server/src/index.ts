import { startServer } from "./server.js";

const PORT = Number.parseInt(process.env.COLLAB_SERVER_PORT || "1234", 10);

console.log("🚀 Starting Hocuspocus collaborative editing server...");

// 启动服务器
(async () => {
  try {
    await startServer(PORT);
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
})();
