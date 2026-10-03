# 自托管 API 镜像（DB_DRIVER=mongo）
#
# 只装生产依赖：@cloudbase/node-sdk 在自托管形态下不会被 require（见 db/context.js 的分支），
# 但保留在依赖里是为了同一份代码既能自托管也能部署到 CloudBase。
FROM node:20-alpine

WORKDIR /app

# 先只拷 package*.json，让依赖层能被缓存复用
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .

ENV NODE_ENV=production \
    PORT=8080 \
    DB_DRIVER=mongo

EXPOSE 8080

# 以非 root 运行
USER node

# 用 wget 做存活探针（alpine 自带）
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/health > /dev/null || exit 1

CMD ["node", "server.js"]
