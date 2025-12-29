FROM node:20-alpine AS runner

WORKDIR /app

# 设置生产环境
ENV NODE_ENV=production
ENV PORT=3000

# 复制 standalone 构建产物
COPY standalone/ ./

WORKDIR /app/apps/web

EXPOSE 3000

CMD ["node", "server.js"]
