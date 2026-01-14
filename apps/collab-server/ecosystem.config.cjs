const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");

// 加载项目根目录的 .env.local 文件
const envPath = path.resolve(__dirname, "../../.env.local");
const envConfig = fs.existsSync(envPath)
  ? dotenv.parse(fs.readFileSync(envPath))
  : {};

module.exports = {
  apps: [
    {
      name: "collab-server",
      script: "./dist/index.js",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
        ...envConfig,
      },
      // 可选配置
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
    },
  ],
};
