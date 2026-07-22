const path = require("node:path");

// PM2 进程编排：先执行构建（pnpm build / build:server），再运行打包产物
// 启动：pm2 start ecosystem.config.js
// 注意：PM2 6 的 env_file 选项实测不生效，改用 node --env-file 注入环境变量
const envFile = path.join(__dirname, ".env.local");

module.exports = {
  apps: [
    {
      name: "web",
      cwd: path.join(__dirname, "apps/web"),
      // Next.js CLI 入口（等价于 next start），PM2 默认用 node 执行
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      // 等价于 dotenv -e ../../.env.local，注入根目录环境变量（Node >= 20.6）
      node_args: `--env-file=${envFile}`,
      env: {
        NODE_ENV: "production",
      },
      max_memory_restart: "1G",
      restart_delay: 3000,
      max_restarts: 10,
      time: true,
    },
    {
      name: "server",
      cwd: path.join(__dirname, "apps/server"),
      // tsc 构建产物入口（等价于 node dist/node-server.js）
      script: "dist/node-server.js",
      node_args: `--env-file=${envFile}`,
      env: {
        NODE_ENV: "production",
      },
      max_memory_restart: "1G",
      restart_delay: 3000,
      max_restarts: 10,
      time: true,
    },
  ],
};
