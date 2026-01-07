import { startServer } from "./server.js";

const PORT = Number.parseInt(process.env.COLLAB_SERVER_PORT || "1234", 10);

console.log("🚀 Starting Hocuspocus collaborative editing server...");

startServer(PORT);
